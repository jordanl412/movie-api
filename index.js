const express = require('express');
const { default: mongoose } = require('mongoose');
    morgan = require('morgan');
    bodyParser = require('body-parser');
    uuid = require('uuid');
    //mongoose = require('mongoose');
    Models = require('./models.js');
const app = express();

let Movies = Models.Movie;
let Users = Models.User;
let allowedOrigins = ['http://localhost:8080', 'http://localhost:1234'];

const { check, validationResult } = require('express-validator');

/*mongoose.connect('mongodb://localhost:27017/myFlixDB', {
    useNewUrlParser: true, useUnifiedTopology: true
});*/

mongoose.connect(process.env.CONNECTION_URI, {
    useNewUrlParser: true, useUnifiedTopology: true
});

const cors = require('cors');
app.use(cors({
    origin: (origin, callback) => {
        if(!origin) return callback(null, true);
        if(allowedOrigins.indexOf(origin) === -1){
            let message = 'The CORS policy for this application doesn\'t allow access from origin ' 
            + origin;
            return callback(new Error(message), false);
        }
        return callback(null, true);
    }
}));

app.use(express.static('public'));
app.use(morgan('common'));
app.use(bodyParser.json());

let auth = require('./auth')(app);
const passport = require('passport');
require('./passport');

//GET requests
//Return a list of all movies
app.get('/movies', passport.authenticate('jwt', {session: false}), (req, res) => {
    Movies.find()
        .then((movies) => {
            res.status(200).json(movies);
        })
        .catch((error) => {
            console.error(error);
            res.status(500).send('Error: ' + error);
        });
});

//Return data about a movie, by title;
app.get('/movies/:Title', passport.authenticate('jwt', {session: false}), (req, res) => {
    Movies.findOne({Title: req.params.Title})
        .then((movie) => {
            res.status(200).json(movie);
        })
        .catch((error) => {
            console.error(error);
            res.status(500).send('Error: ' + error);
        });
});

//Return data about a genre by name
app.get('/movies/genres/:genreName', passport.authenticate('jwt', {session: false}), (req, res) => {
    Movies.findOne({'Genre.Name': req.params.genreName})
        .then((movie) => {
            res.status(200).json(movie.Genre);
        })
        .catch((error) => {
            console.error(error);
            res.status(500).send('Error: ' + error);
        });
});

//Return data about a director by name
app.get('/movies/directors/:directorName', passport.authenticate('jwt', {session: false}), (req, res) => {
    Movies.findOne({'Director.Name': req.params.directorName})
        .then((movie) => {
            res.status(200).json(movie.Director);
        })
        .catch((error) => {
            console.error(error);
            res.status(500).send('Error: ' + error);
        });
});

//Get all users
app.get('/users', passport.authenticate('jwt', {session: false}), (req, res) => {
    Users.find()
        .then((users) => {
            res.status(200).json(users);
        })
        .catch((error) => {
            console.error(error);
            res.status(500).send('Error: ' + error);
        });
});

//Get a user by username
app.get('/users/:Username', passport.authenticate('jwt', {session: false}), (req, res) => {
    Users.findOne({ Username: req.params.Username })
        .then((user) => {
            res.status(200).json(user);
        })
        .catch((error) => {
            console.error(error);
            res.status(500).send('Error: ' + error);
        });
});

//POST and PUT requests
//Allow new users to register
app.post('/users', 
    [
        check('Username', 'Username is required').isLength({min: 5}),
        check('Username', 'Username contains non-alphanumeric characters - not allowed.').isAlphanumeric(),
        check('Password', 'Password is required').not().isEmpty(),
        check('Email', 'Email does not appear to be valid.').isEmail()
    ], (req, res) => {
        let errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).json({errors: errors.array()});
        }
        let hashedPassword = Users.hashPassword(req.body.Password);
        Users.findOne({Username: req.body.Username})
            .then((user) => {
                if (user) {
                    return res.status(400).send(req.body.Username + ' already exists');
                } else {
                    Users.create({
                        Username: req.body.Username,
                        Password: hashedPassword,
                        Email: req.body.Email,
                        Birthday: req.body.Birthday
                    })
                    .then((user) => {res.status(201).json(user)})
                    .catch((error) => {
                        console.error(error);
                        res.status(500).send('Error: ' + error);
                    })
            }
        })
        .catch((error) => {
            console.error(error);
            res.status(500).send('Error: ' + error);
        });
});

//Allow users to update their user info
app.put('/users/:Username', 
[
    check('Username', 'Username is required').isLength({min: 5}),
    check('Username', 'Username contains non-alphanumeric characters - not allowed.').isAlphanumeric(),
    check('Password', 'Password is required').not().isEmpty(),
    check('Email', 'Email does not appear to be valid.').isEmail()
], passport.authenticate('jwt', {session: false}), (req, res) => {
    Users.findOneAndUpdate({ Username: req.params.Username },
        { $set:
            {
                Username: req.body.Username,
                Password: req.body.Password,
                Email: req.body.Email,
                Birthday: req.body.Birthday
            }
        },
        { new: true }, 
        (err, updatedUser) => {
            if (err) {
                console.error(error);
                res.status(500).send('Error: ' + error);
            } else {
                res.status(201).json(updatedUser);
            }
        });
});


//Allow users to add a movie to their list of favorites
app.post('/users/:Username/movies/:MovieID', passport.authenticate('jwt', {session: false}), (req, res) => {
    Users.findOneAndUpdate({Username: req.params.Username}, 
        {
            $push: {FavoriteMovies: req.params.MovieID}
        },
        {new: true}, 
        (error, updatedUser) => {
            if (error) {
                console.error(error);
                res.status(500).send('Error: ' + error);
            } else {
                res.status(201).json(updatedUser);
            }
        });
});


//DELETE requests
//Allow users to remove a movie from their list of favorites
app.delete('/users/:Username/movies/:MovieID', passport.authenticate('jwt', {session: false}), (req, res) => {
    Users.findOneAndUpdate({Username: req.params.Username},
    {
        $pull: {FavoriteMovies: req.params.MovieID}
    },
    {new: true},
    (error, updatedUser) => {
        if (error) {
            console.error(error);
            res.status(500).send('Error: ' + error);
        } else {
            res.status(200).json(updatedUser);
        }
    });
});

//Delete a user by username
app.delete('/users/:Username', passport.authenticate('jwt', {session: false}), (req, res) => {
    Users.findOneAndRemove({Username: req.params.Username})
    .then((user) => {
        if (!user) {
            res.status(400).send(req.params.Username + ' was not found');
        } else {
            res.status(200).send(req.params.Username + ' was deleted.');
        }
    })
    .catch((error) => {
        console.error(error);
        res.status(500).send('Error: ' + error);
    });
});



app.get('/', (req, res) => {
    res.send('Welcome to the myFlix API!');
});

app.get('/documentation', (req, res) => {
    res.sendFile('public/documentation.html', {root: __dirname});
});

//Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

//listen for requests
const port = process.env.PORT || 8080;
app.listen(port, '0.0.0.0', () => {
    console.log('Listening on Port ' + port);
});