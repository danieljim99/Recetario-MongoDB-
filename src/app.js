import {MongoClient, ObjectID} from 'mongodb';
import {GraphQLServer} from "graphql-yoga";
import "babel-polyfill";

const url = "mongodb+srv://username:password99@thecluster-mzag5.gcp.mongodb.net/test";

const dbConnect = async function(url) {
    const client = new MongoClient(url, {useNewUrlParser: true, useUnifiedTopology: true});
    await client.connect();
    return client;
}

const runGraphQLServer = function(context) {
    const typeDefs = `
        type Query {
            recipes(author: ID, ingredient: ID): [Recipe!]!
            authors: [Author!]!
            ingredients: [Ingredient!]!
        }

        type Mutation {
            addAuthor(name: String!, email: String!): Author!
            addIngredient(name: String!): Ingredient!
            addRecipe(title: String!, author: ID!, ingredients: [ID!]): Recipe!
            removeAuthor(_id: ID!): Author!
            removeRecipe(_id: ID!): Recipe!
            removeIngredient(_id: ID!): Ingredient!
            updateIngredient(_id: ID!, name: String!): Ingredient!
            updateAuthor(_id: ID!, name: String!, email: String!): Author!
            updateRecipe(_id: ID!, title: String!, author: ID!, ingredients: [ID!]!): Recipe!
        }

        type Recipe {
            _id: ID!
            title: String!
            author: Author!
            ingredients: [Ingredient!]!
        }

        type Author {
            _id: ID!
            name: String!
            email: String!
            recipes: [Recipe!]
        }

        type Ingredient {
            _id: ID!
            name: String!
            recipes: [Recipe!]

        }
    `

    const resolvers = {
        Query: {
            recipes: async (parent, args, context, info) => {
                const {client} = context;
                const db = client.db("recipe_book");
                const collection = db.collection("recipes");

                let result = await collection.find({}).toArray();

                if(args.author){
                    result = result.filter(obj => obj.author == args.author);
                }

                if(args.ingredient){
                    result = result.filter(obj => obj.ingredients.some(elem => elem == args.ingredient));
                }

                return result;
            },
            authors: async (parent, args, context, info) => {
                const {client} = context;
                const db = client.db("recipe_book");
                const collection = db.collection("authors");
                return await collection.find({}).toArray();
            },
            ingredients: async (parent, args, context, info) => {
                const {client} = context;
                const db = client.db("recipe_book");
                const collection = db.collection("ingredients");
                return await collection.find({}).toArray();
            }
        },

        Mutation: {
            addRecipe: async (parent, args, context, info) => {
                const {client} = context;
                const db = client.db("recipe_book");

                const recipesCollection = db.collection("recipes");
                const authorsCollection = db.collection("authors");
                const ingredientsCollection = db.collection("ingredients");

                const recipeData = await recipesCollection.find({}).toArray();
                const authorData = await authorsCollection.find({}).toArray();
                const ingredientData = await ingredientsCollection.find({}).toArray();

                if(recipeData.some(obj => obj.title === args.title)){
                    throw new Error(`The title ${args.title} is already in use`);
                }

                if(!authorData.some(obj => obj._id == args.author)){
                    throw new Error(`The author ${args.author} does not exist`);
                }

                args.ingredients.forEach(elem => {
                    if(!ingredientData.some(obj => obj._id == elem)){
                        throw new Error(`The ingredient ${elem} does not exist`);
                    }
                });

                const recipe = {
                    title: args.title,
                    author: ObjectID(args.author),
                    ingredients: args.ingredients.map(obj => ObjectID(obj)),
                };

                const response = await recipesCollection.insertOne(recipe);
                return {
                    ...recipe, 
                    _id: response.ops[0]._id
                };
            },
            addAuthor: async (parent, args, context, info) => {
                const author = {
                    name: args.name,
                    email: args.email,
                };
                const {client} = context;
                const db = client.db("recipe_book");
                const collection = db.collection("authors");
                const authorData = await collection.find({}).toArray();

                if(authorData.some(obj => obj.name === args.name)){
                    throw new Error(`The name ${args.name} is already in use`);
                }

                if(authorData.some(obj => obj.email === args.email)){
                    throw new Error(`The email ${args.email} is already in use`);
                }

                const response = await collection.insertOne(author);

                return {
                    ...author,
                    _id: response.ops[0]._id,
                };
            },
    
            addIngredient: async (parent, args, context, info) => {
                const ingredient = {
                    name: args.name,
                };

                const {client} = context;
                const db = client.db("recipe_book");
                const collection = db.collection("ingredients");
                const ingredientData = await collection.find({}).toArray();

                if(ingredientData.some(obj => obj.name === args.name)){
                    throw new Error(`The ingredient ${args.name} is already in use`);
                }

                const response = await collection.insertOne(ingredient);

                return {
                    ...ingredient,
                    _id: response.ops[0]._id,
                };
            },
    
            removeRecipe: async (parent, args, context, info) => {
                const {client} = context;
                const db = client.db("recipe_book");
                const collection = db.collection("recipes");
                const recipeData = await collection.find({}).toArray();

                if(!recipeData.some(obj => obj._id == args._id)){
                    throw new Error(`There is no recipes with the id ${args._id}`);
                }

                return (await collection.findOneAndDelete({_id: ObjectID(args._id)})).value;
            },
    
            removeAuthor: async (parent, args, context, info) => {
                const {client} = context;
                const db = client.db("recipe_book");

                const authorsCollection = db.collection("authors");
                const recipesCollection = db.collection("recipes");

                const authorData = await authorsCollection.find({}).toArray();
                const recipeData = await recipesCollection.find({}).toArray();

                if(!authorData.some(obj => obj._id == args._id)){
                    throw new Error(`There is no authors with id ${args._id}`);
                }

                recipeData.filter(obj => obj.author == args._id).forEach(async (elem) => {
                    await recipesCollection.findOneAndDelete({_id: elem._id});
                });

                return (await authorsCollection.findOneAndDelete({_id: ObjectID(args._id)})).value;
            },
    
            removeIngredient: async (parent, args, context, info) => {
                const {client} = context;
                const db = client.db("recipe_book");

                const ingredientsCollection = db.collection("ingredients");
                const recipesCollection = db.collection("recipes");

                const ingredientData = await ingredientsCollection.find({}).toArray();
                const recipeData = await recipesCollection.find({}).toArray();

                if(!ingredientData.some(obj => obj._id == args._id)){
                    throw new Error(`There is no ingredients with id ${args._id}`);
                }

                recipeData.filter(obj => obj.ingredients.some(elem => elem == args._id)).forEach(async (elem) => {
                    await recipesCollection.findOneAndDelete({_id: elem._id});
                });

                return (await ingredientsCollection.findOneAndDelete({_id: ObjectID(args._id)})).value;
            },
    
            updateIngredient: async (parent, args, context, info) => {
                const {client} = context;
                const db = client.db("recipe_book");
                const collection = db.collection("ingredients");
                const ingredientData = await collection.find({}).toArray();

                if(!ingredientData.some(obj => obj._id == args._id)){
                    throw new Error(`There is no ingredients with the id ${args._id}`);
                }

                if(ingredientData.some(obj => obj.name === args.name)){
                    throw new Error(`The name ${args.name} is already in use`);
                }

                return (await collection.findOneAndUpdate({_id: ObjectID(args._id)}, {$set: {name: args.name}}, {returnOriginal: false})).value;
            },
    
            updateAuthor: async (parent, args, context, info) => {
                const {client} = context;
                const db = client.db("recipe_book");
                const collection = db.collection("authors");
                const authorData = await collection.find({}).toArray();

                if(!authorData.some(obj => obj._id == args._id)){
                    throw new Error(`There is no authors with the id ${args._id}`);
                }

                if(authorData.some(obj => obj.name === args.name)){
                    throw new Error(`The name ${args.name} is already in use`);
                }

                if(authorData.some(obj => obj.email === args.email)){
                    throw new Error(`The email ${args.email} is already in use`);
                }

                return (await collection.findOneAndUpdate({_id: ObjectID(args._id)}, {$set: {name: args.name, email: args.email}}, {returnOriginal: false})).value;
            },
    
            updateRecipe: async (parent, args, context, info) => {
                const {client} = context;
                const db = client.db("recipe_book");

                const recipesCollection = db.collection("recipes");
                const authorsCollection = db.collection("authors");
                const ingredientsCollection = db.collection("ingredients");

                const recipeData = await recipesCollection.find({}).toArray();
                const authorData = await authorsCollection.find({}).toArray();
                const ingredientData = await ingredientsCollection.find({}).toArray();

                if(recipeData.some(obj => obj.title === args.title)){
                    throw new Error(`The title ${args.title} is already in use`);
                }

                if(!authorData.some(obj => obj._id == args.author)){
                    throw new Error(`The author ${args.author} does not exist`);
                }

                args.ingredients.forEach(elem => {
                    if(!ingredientData.some(obj => obj._id == elem)){
                        throw new Error(`The ingredient ${elem} does not exist`);
                    }
                });

                return (await recipesCollection.findOneAndUpdate({_id: ObjectID(args._id)}, {$set: {title: args.title, author: ObjectID(args.author), ingredients: args.ingredients.map(obj => ObjectID(obj))}}, {returnOriginal: false})).value;
            }
        },
    
        Recipe: {
            author: async (parent, args, context, info) => {
                const {client} = context;
                const db = client.db("recipe_book");
                const collection = db.collection("authors");
                const author = await collection.findOne({_id: ObjectID(parent.author)});

                return author;
            },
            ingredients: async (parent, args, context, info) => {
                const ingredients = [];

                const {client} = context;
                const db = client.db("recipe_book");
                const collection = db.collection("ingredients");
                
                parent.ingredients.forEach(elem => {
                    ingredients.push(collection.findOne({_id: ObjectID(elem)}));
                });

                return ingredients;
            }
        },
    
        Author: {
            recipes: async (parent, args, context, info) => {
                const {client} = context;
                const db = client.db("recipe_book");
                const collection = db.collection("recipes");
                const recipes = await collection.find({author: parent._id}).toArray();

                return recipes;
            }
        },
    
        Ingredient: {
            recipes: async (parent, args, context, info) => {
                const parentID = [parent._id];

                const {client} = context;
                const db = client.db("recipe_book");
                const collection = db.collection("recipes");
                const recipes = await collection.find({ingredients: parentID}).toArray();

                return recipes;
            }
        }
    }

    const server = new GraphQLServer({typeDefs,resolvers, context});
    server.start(() => console.log("Server started"));
}

const runApp = async function() {
    const client = await dbConnect(url);
    try {
        runGraphQLServer({client});
    } catch(e) {
        client.close();
    }
}

runApp();