const express = require("express"); /* Accessing express module */
const app = express(); /* app is a request handler function */
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");
const cookieParser = require("cookie-parser");
require("dotenv").config({ path: path.resolve(__dirname, '\.env') })

process.stdin.setEncoding("utf8");

app.set("views", path.resolve(__dirname, "templates"));
app.set("view engine", "ejs");

app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(
  session({
    resave: true,
    saveUninitialized: false,
    secret: process.env.VICTORIAS_SECRET,
  })
);

app.use(express.static("./images"));

const uri = `mongodb+srv://${process.env.MONGO_DB_USERNAME}:${process.env.MONGO_DB_PASSWORD}@cluster0.zmmtp.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const db_name = process.env.MONGO_DB_NAME;
const collection_name = process.env.MONGO_COLLECTION;
const databaseAndCollection = {db: db_name, collection: collection_name};

const { MongoClient, ServerApiVersion } = require('mongodb');

const portNumber = 4000;
app.listen(portNumber);
console.log(`Web server started and running at http://localhost:${portNumber}`);

const prompt = "Stop to shutdown the server: ";
process.stdout.write(prompt);
process.stdin.on("readable", function () {
    const dataInput = process.stdin.read();
    if (dataInput !== null) {
      const command = dataInput.trim();
      if (command === "stop") {
        process.stdout.write("Shutting down the server\n");
        process.exit(0);
      }
    }
});

app.get("/", (req, res) => {
    const p = {
        act: "/login",
        labelTag: "Please Enter Your Email",
        submitBtn: "Login"
    }
    res.render("index", p);
});

app.get("/main", (req, res) => {
    const info = {
        user: req.session.email,
    }
    res.render('main', info);
});

app.get("/encounter", (req, res) => {
    res.render("encounter");
});

app.get("/random", async (req, res) => {
    let pokemonID = Math.floor(Math.random() * 1025) + 1;
    let shinyRate = Math.floor(Math.random() * 4096);

    const pokemonData = await (await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonID}/`)).json();
    const speciesData = await (await fetch(`https://pokeapi.co/api/v2/pokemon-species/${pokemonID}/`)).json();

    let pokemonInfo = {
        pokemonCry: pokemonData.cries.latest,
        encounterType: speciesData.is_legendary? `<h2 style="color: yellow"> ⭐A LEGENDARY ENCOUNTER⭐ </h2>`: 
            speciesData.is_mythical? `<h2 style="color: rgb(255, 91, 244)">  🔮A MYTHICAL ENCOUNTER🔮 </h2>`: ``, 
        shiny: shinyRate ==! 0? `<span style="color: yellow">✨ SHINY ✨</span>`: ``,
        isShiny: shinyRate ==!0? "y" : "n",
        pokemon: pokemonData.name.toUpperCase(), 
        sprite: shinyRate ==! 0? `<img src="${pokemonData.sprites.front_shiny}" style="border: inset; border-color: rgb(0, 153, 0); border-radius: 30px; border-width: thick">` :
             `<img src="${pokemonData.sprites.front_default}" style="border: inset; border-radius: 30px; border-color:green; border-width: thick">`,
        spriteStorage: shinyRate ==! 0? pokemonData.sprites.front_shiny : pokemonData.sprites.front_default,
        catchRate: speciesData.capture_rate
    }

    res.render("random", pokemonInfo);
});

app.get("/pc", async (req, res) => {

    const trainerInfo = await searchTrainer(req.session.email).catch(console.error);
    let table =`<table border="1"><tr><th>Sprite</th><th>Name</th><th>Date Caught</th></tr>`;
    
    if (trainerInfo.pokemonList.length !== 0) {
        trainerInfo.pokemonList.forEach(elm => {
            table += `<tr><td><img src = ${elm.sprite}></td>`;
            table += `<td>${elm.pokemon}</td>`;
            table += `<td>${elm.dateCaught}</td></tr>`;
        });

        table += `</table>`
    } else {
        table = `<h3>You haven't caught any Pokémon yet! Go catch them and mezase Pokémon master!</h3>`
    }

    res.render("pc", {user: req.session.email, pokemonTable : table});
});

app.get("/pokedex", async (req, res) => {
    const trainerInfo = await searchTrainer(req.session.email).catch(console.error);

    const allPokemon = await searchTrainer("SATOSHI").catch(console.error);

    let table =`<table border="1"><tr><th>Sprite</th><th>Name</th><th>Caught?</th></tr>`;

    allPokemon.AllPokemon.forEach(elm => {
        table += `<tr><td><img src="${elm.sprite}"></td>`;
        table += `<td>${elm.name}</td>`;
        table += trainerInfo.pokedexList.includes(elm.name.toUpperCase()) ? `<td>✅</td></tr>` : `<td>❌</td></tr>`;
    });
    
    table += `</table>`

    const total = `<h2>You've Caught ${trainerInfo.pokedexList.length}/1025 Pokémon! </h2>`
    res.render("pokedex", {Total:total, pokemonTable : table});
});

app.use(bodyParser.urlencoded({extended:false}));

app.post("/login", (req, res) => {
    let {email} = req.body;

    searchTrainer(email).catch(console.error).then(result => {
        if (result == null) {
            const p = {
                act: "/createNewAccount",
                labelTag: `<span style="color:red">ACCOUNT DOESN'T EXIST. CREATE A NEW ACCOUNT</span>`,
                submitBtn: `Sign Up`
            }

            res.render("index", p);
        } else {
            req.session.email = email;
            req.session.save();
            res.redirect("/main");
        }
    });

});

app.post('/createNewAccount', (req, res) => {
    let {email} = req.body;

    searchTrainer(email).catch(console.error).then(result => {
        if (result != null) {
            const p = {
                act: "/createNewAccount",
                labelTag: `<span style="color:red">EMAIL ALREADY USED. ENTER NEW EMAIL</span>`,
                submitBtn: `Sign Up`
            }

            res.render("index", p);
        } else {
            req.session.email = email;
            req.session.save();

            const data = {
                email: email,
                pokemonList: [],
                pokedexList:[]    
            }
            insertTrainer(data).catch(console.error);
            res.redirect("/main");
        }
    });
});

app.post("/random", async (req, res) => {
    let {pokemon, sprite, shiny, catchRate} = req.body;

    catchRate = catchRate / 256; 
    const randomNum = Math.random();

    let info = {
        pokemon: shiny === "y"? `<span style="color:yellow">✨${pokemon}✨</span>`: pokemon
    };

    if (randomNum < catchRate) {

        const trainerInfo = await searchTrainer(req.session.email).catch(console.error);
        let pkList = trainerInfo.pokemonList;
        let pdexList = trainerInfo.pokedexList;

        let d = new Date();

        const newPokemon = {
            pokemon: pokemon,
            shiny: shiny, 
            sprite: sprite,
            dateCaught: `${d.getMonth() + 1}-${d.getDate()}-${d.getFullYear()}`
        }

        pkList.push(newPokemon);
        if (!pdexList.includes(pokemon)) {
            pdexList.push(pokemon);
        }
        
        const newValues = {pokemonList: pkList, pokedexList: pdexList};
        await updateTrainer(req.session.email, newValues).catch(console.error);

        res.render("success", info);
    } else {
        res.render("fail", info);
    }
});



async function insertTrainer(data) {
    const client = new MongoClient(uri, {serverApi: ServerApiVersion.v1 });
    try {
        await client.connect();

        const result = await client.db(databaseAndCollection.db)
                        .collection(databaseAndCollection.collection)
                        .insertOne(data);

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

async function searchTrainer(entry_email) {
    const client = new MongoClient(uri, {serverApi: ServerApiVersion.v1 });

    try {
        await client.connect();
        let filter = {email: entry_email};
        const result = await client.db(databaseAndCollection.db)
                        .collection(databaseAndCollection.collection)
                        .findOne(filter);
        
        return result;

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

async function updateTrainer(email, newValues) {
    const client = new MongoClient(uri, {serverApi: ServerApiVersion.v1 });

    try {
        await client.connect();
        let filter = {email: email};
        let update = {$set: newValues};

        const result = await client.db(databaseAndCollection.db)
        .collection(databaseAndCollection.collection)
        .updateOne(filter, update);

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }

}
