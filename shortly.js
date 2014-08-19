var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var bcrypt = require('bcrypt-nodejs');
var session = require('express-session');
var cookieParser = require('cookie-parser');

var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();
app.use(cookieParser('shhhhh, very secret'));
app.use(session());

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));

function restrict(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    req.session.error = 'Access denied!';
    res.redirect('/login');
  }
};

app.get('/',
function(req, res) {
  restrict(req, res, function(){
    res.render('index');
  });
});

// if clicked create account, render signup html
app.get('/signup',
function(req, res) {
  res.render('signup');
});

//Signup new users
app.post('/signup',
function(req, res) {
  var username = req.body.username;
  var password = req.body.password;

  new User({userName: username}).fetch()
  .then(function(exists){
    if(exists){
      //fetch will return true if username already exists in collection
      console.log("This username already exists");
    } else if (!exists) {

      var user = new User({
        userName: username,
        password: password
      });

      user.save()
      .then(function(newUser){
        Users.add(newUser);
        console.log("newUser: ",newUser);
        return res.render('login');
      });
    }
  });
});


//For login
app.post('/login',
  function(req, res){
  var username = req.body.username;
  var password = req.body.password;

  new User({userName: username}).fetch()
  .then(function(exists){
    if(exists){
      bcrypt.compare(password, exists.attributes.password, function(err, check){
        if(check === true){
          req.session.regenerate(function(){
            req.session.user = username;
            res.redirect('index');
          });
        } else {
          console.log('Password is invalid');
          res.render('login');
        }
      });
    } else if (!exists) {
      console.log('Username and/or password is invalid');
      res.render('login');
    }
  });
});



app.get('/create',
function(req, res) {
  res.render('index');
});

app.get('/links',
function(req, res) {
  Links.reset().fetch().then(function(links) {
    res.send(200, links.models);
  });
});

app.post('/links',
function(req, res) {
  var uri = req.body.url;
  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        var link = new Link({
          url: uri,
          title: title,
          base_url: req.headers.origin
        });

        link.save().then(function(newLink) {
          Links.add(newLink);
          res.send(200, newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/

/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('urls')
          .where('code', '=', link.get('code'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            return res.redirect(link.get('url'));
          });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
