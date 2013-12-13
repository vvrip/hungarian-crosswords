/*
var express = require('express');
var routes = require('./routes');
var user = require('./routes/user');
var http = require('http');
var path = require('path');

var app = express();

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.cookieParser('your secret here'));
app.use(express.session());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

app.get('/', routes.index);
app.get('/users', user.list);

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});
       */

var express = require('express');
var path = require('path');
var mysql = require('mysql');

var app = require('express')()
    , server = require('http').createServer(app)
    , io = require('socket.io').listen(server);

var MemoryStore = express.session.MemoryStore;
app.use(express.static(path.join(__dirname, 'public')));
var sessionStore = new MemoryStore(), authStore = new MemoryStore();

server.listen(88);

app.use(express.bodyParser());
app.use(express.cookieParser());
app.use(express.session({
    key : 'express.sid',
    store: new MemoryStore(),
    secret: 'secret'
}));
app.use(app.router);

app.get('/', function (req, res) {
    /*try{
        if(req.session.username){
            res.redirect('/main');
        }
    }catch(err){
        console.log('Err : ' + err);
    }*/
    res.sendfile(__dirname + '/index.html');
});

app.get('/main', function (req, res) {
    console.log('Try read user param');
    try{
        if(!req.session.username){
            req.session.username = authStore.user;
            console.log("User : " + req.session.username);
        }
        sessionStore.user = req.session.username;
    }catch(err2){
        console.log('Err2 : ' + err2);
    }
    res.sendfile(__dirname + '/main.html');
});

app.get('/wait_rival', function (req, res) {
    if(req.session.username){
        sessionStore.user = req.session.username;
        console.log("User wait rival : " + req.session.username);
    }

    if(!req.session.username){
        res.redirect('/');
    }else{
        sessionStore.user = req.session.username;
    }
    res.sendfile(__dirname + '/wait_second_player.html');
});

app.get('/game', function (req, res) {
    if(req.session.username){
        sessionStore.user = req.session.username;
        console.log("User in game : " + req.session.username);
    }

    if(!req.session.username){
        res.redirect('/');
    }else{
        sessionStore.user = req.session.username;
    }
    res.sendfile(__dirname + '/game.html');
});

var Sockets = [];
var SocketsWaiters = [];

io.sockets.on('connection', function (socket) {
    socket.session = {};
    socket.emit('news', { hello: 'world' });
    socket.on('my other event', function (data) {
        console.log(data);
    });

    socket.on('reg', function(data){
        //sessionStore.user = '';
        //sessionStore.score = 0;
        //sessionStore.wins = 0;
        //sessionStore.losts = 0;
        var connection = mysql.createConnection({
            host: 'localhost',
            port: 3306,
            user: 'root',
            password: ''
        });
        connection.connect();
        console.log('Connected successfully!');
        connection.query('use node');
        user = data['user'];
        password = data['password'];

        connection.query('insert into users (name, password) values(\'' + user + '\',\'' + password + '\')', function(error, result, fields){
            // Если возникла ошибка выбрасываем исключение
            if (error){
                socket.emit('reg', { response: 'no'});
                console.log("Reg err : " + error);
                return;
            }
            authStore.user = user;
            console.log("Registration complete : login = " + sessionStore.user);
            socket.emit('reg', { response: 'yes'});
        });

        connection.query('SELECT * FROM users where name = \'' + user + '\';', function(error, result, fields){
            if (error){
                console.log("Reg err : " + error);
                socket.emit('reg', { response: 'no'});
                return;
            }
            console.log("Res : " + result.length);
            if(result.length == 0){
                return;
            }
            //authStore.score = result[0].score_wins - result[0].score_losts;
            //authStore.wins = result[0].score_wins;
            //authStore.losts = result[0].score_losts;
        });
        // Завершаем соединение
        connection.end();
    });

    socket.on('author', function (data) {
        var connection = mysql.createConnection({
            host: 'localhost',
            port: 3306,
            user: 'root',
            password: ''
        });
        user = data['user'];
        password = data['password'];
        connection.connect();
        console.log('Connected successfully!');
        connection.query('use node');
        connection.query('SELECT * FROM users where name = \'' + user + '\' and password = \'' + password + '\';',
            function(error, result, fields){
                // Если возникла ошибка выбрасываем исключение
                if (error){
                    socket.emit('author', { response: 'no'});
                    console.log("Auth err : " + error);
                    return;
                }

                if(result.length == 0){
                    socket.emit('author', { response: 'no'});
                    console.log("Auth err : incorrect login or password!");
                    return;
                }

                console.log("Auth : login = " + user);
                authStore.user = user;
                //authStore.score = result[0].score_wins - result[0].score_losts;
                //authStore.wins = result[0].score_wins;
                //authStore.losts = result[0].score_losts;
                socket.emit('author', { response: 'yes' });
            });
        // Завершаем соединение
        connection.end();
    });

    socket.on('getUserData', function () {
        console.log('Get user data');
        var usr = '';
        var connection = mysql.createConnection({
            host: 'localhost',
            port: 3306,
            user: 'root',
            password: ''
        });
        connection.connect();
        console.log('Connected successfully!');
        connection.query('use node');
        connection.query('SELECT * FROM users where name = \'' + sessionStore.user + '\';',
            function(error, result, fields){
                // Если возникла ошибка выбрасываем исключение
                if (error){
                    socket.emit('author', { response: 'no'});
                    console.log("Auth err : " + error);
                    return;
                }
                socket.emit('user', { username : sessionStore.user});
                socket.emit('score', { response: result[0].score_wins - result[0].score_losts});//sessionStore.score });
                socket.emit('wins', { response: result[0].score_wins});//sessionStore.wins });
                socket.emit('losts', { response: result[0].score_losts});//sessionStore.losts });
                console.log('Getting user name : ' + sessionStore.user);
            });
        // Завершаем соединение
        connection.end();
    });

    socket.on('getCrossword', function () {
        Sockets.push(socket);
        if(!socket.session.username){
            socket.session.username = sessionStore.user;
            console.log('Socket user in game : ' + socket.session.username);
        }
        if(socket.session.username){
            console.log('Waiter : ' + sessionStore.user1);
            console.log('Rival : ' + sessionStore.user2);
            if(sessionStore.user1 == socket.session.username){
                socket.session.userrival = sessionStore.user2;
                socket.emit('yourrival', {username : socket.session.username, rival : sessionStore.user2});
            }
            if(sessionStore.user2 == socket.session.username){
                socket.session.userrival = sessionStore.user1;
                socket.emit('yourrival', {username : socket.session.username, rival : sessionStore.user1});
            }
        }
        var fs = require("fs");
        fs.readFile(__dirname+'/cross_1.json', function (err, data){
            if(err){
                console.log(err);
                return;
            }
            var cross = JSON.parse(data);
            socket.emit('crossword', {cross: cross});
        });
    });

    socket.on('exit', function() {
        sessionStore.user = '';
        /*сделать людской выход*/
    });

    socket.on('getRival', function(data){
        if(!sessionStore.waiter){
            sessionStore.waiter = sessionStore.user;
            socket.session = {};
            socket.session.username = sessionStore.user;
            console.log('Socket user : ' + socket.session.username);
            SocketsWaiters.push(socket);
        }else{
            console.log('Searching rival ...');
            for(var i = 0; i<SocketsWaiters.length; i++){
                if(SocketsWaiters[i]){
                    try{
                        console.log(SocketsWaiters[i].session.username);
                        console.log('Read success!');
                    }catch(e){
                        console.log('err');
                        console.log(e);
                        continue;
                    }
                    if(SocketsWaiters[i].session.username){
                        if(SocketsWaiters[i].session.username == sessionStore.waiter){
                            if(!sessionStore.user2){
                                sessionStore.user1 = SocketsWaiters[i].session.username;
                                sessionStore.user2 = sessionStore.user;
                            }
                            console.log('Waiter : ' + sessionStore.user1);
                            console.log('Rival : ' + sessionStore.user2);
                            SocketsWaiters[i].emit('rival');
                            console.log('Sending rivals ...');
                            setTimeout(
                                function(){
                                    socket.emit('rival');
                                    console.log('Rivals sended!');
                                }, 1500);
                            SocketsWaiters.pop();
                            break;
                        }
                    }
                }
            }
            sessionStore.waiter = undefined;
        }
    });

    socket.on('wordIsFindMe', function(data){
        cells = data['cells'];
        word = data['word'];
        for(var i = 0; i<Sockets.length; i++){
            if(Sockets[i].session.username == socket.session.userrival){
                console.log('Sending word from ' + socket.session.username + ' to ' + Sockets[i].session.username);
                //socket.emit('wordIsFindOther');
                Sockets[i].emit('wordIsFindOther', {cells : cells, word : word});
            }
        }
    });
});