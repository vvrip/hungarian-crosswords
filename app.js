var express = require('express'),
       path = require('path'),
      mysql = require('mysql'),
      fs    = require('fs'),
      nconf = require('nconf'),
        app = require('express')(),
     server = require('http').createServer(app),
         io = require('socket.io').listen(server),
 nodemailer = require('nodemailer');
 
nconf.env().argv();
nconf.file({ file: 'config.json' });

var MemoryStore = express.session.MemoryStore;
app.use(express.static(path.join(__dirname, 'public')));
var sessionStore = new MemoryStore(), authStore = new MemoryStore();

server.listen(nconf.get('server:port'));

var transporter = nodemailer.createTransport({
    service: nconf.get('mail:service'),
    auth: {
        user: nconf.get('mail:user'),
        pass: nconf.get('mail:password')
    }
});

app.use(express.bodyParser());
app.use(express.cookieParser());
app.use(express.session({
    key: 'express.sid',
    store: new MemoryStore(),
    secret: 'secret'
}));
app.use(app.router);

app.get('/exit', function(req, res) {
    req.session.username = null;
    res.writeHead(302, {'Location': '/'});
    res.end();
});

app.get('/restore', function(req, res) {
    res.sendfile(__dirname + '/restore.html');
});

app.get('/crosswords_editor', function(req, res) {
    res.sendfile(__dirname + '/crosswords_editor.html');
});

app.get('/', function(req, res) {
    try {
        if (req.session.username) {
            res.writeHead(302, {'Location': '/main'});
            res.end();
            return;
        }
    } catch (err) {
        console.log('Err : ' + err);
    }
    res.sendfile(__dirname + '/index.html');
});

app.get('/main', function(req, res) {
    console.log('Try read user param');
    try {
        if (!req.session.username) {
            if (!authStore.user) {
                res.writeHead(302, {'Location': '/'});
                res.end();
                return;
            }
            req.session.username = authStore.user;
            req.session.id_user = authStore.id_user;
            console.log("User : " + req.session.username);
        }
        sessionStore.user = req.session.username;
        sessionStore.id_user = req.session.id_user;
    } catch (err2) {
        console.log('Err2 : ' + err2);
    }
    res.sendfile(__dirname + '/main.html');
    authStore.user = null;
});

app.get('/wait_rival', function(req, res) {

    if (!req.session.username) {
        res.writeHead(302, {'Location': '/'});
        res.end();
        return;
    }

    if (req.session.username) {
        sessionStore.user = req.session.username;
        sessionStore.id_user = req.session.id_user;
        console.log("User wait rival : " + req.session.username);
    }

    if (!req.session.username) {
        res.redirect('/');
    } else {
        sessionStore.user = req.session.username;
        sessionStore.id_user = req.session.id_user;
    }
    res.sendfile(__dirname + '/wait_second_player.html');
});

app.get('/game', function(req, res) {

    if (!req.session.username) {
        res.writeHead(302, {'Location': '/'});
        res.end();
        return;
    }

    if (req.session.username) {
        sessionStore.user = req.session.username;
        sessionStore.id_user = req.session.id_user;
        console.log("User in game : " + req.session.username);
    }

    if (!req.session.username) {
        res.redirect('/');
    } else {
        sessionStore.user = req.session.username;
        sessionStore.id_user = req.session.id_user;
    }
    res.sendfile(__dirname + '/game.html');
});

var Sockets = [];
var SocketsWaiters = [];

io.sockets.on('connection', function(socket) {
    socket.session = {};

    socket.on('reg', function(data) {
        var connection = mysql.createConnection({
            host: nconf.get('database:host'),
            port: nconf.get('database:port'),
            user: nconf.get('database:user'),
            password: nconf.get('database:password')
        });
        connection.connect();
        console.log('Connected successfully!');
        connection.query('use node');
        user = data['user'];
        password = data['password'];

        connection.query('insert into user (login, name, password, is_admin) values(\'' 
                + user + '\',\'' + user + '\',\'' + password + '\', 0);', function(error, result_user, fields) {
                    
            if (error) {
                socket.emit('reg', {response: 'no'});
                console.log("Reg err : " + error);
                return;
            }
            authStore.user = user;
            console.log("Registration complete : login = " + sessionStore.user);
            socket.emit('reg', {response: 'yes'});
            connection.query('SELECT id FROM user where login = \'' + user + '\';', 
                function(error, result_user_id, fields) {
                    connection.end();
                    if (error) {
                        //TODO: error hanler
                        console.log("Reg err : " + error);
                        return;
                    }
                    authStore.id_user = result_user_id[0].id;
                }
            );
        });
    });
    
    socket.on('restore_password', function(data) {
        var mail = data['mail'];
        var connection = mysql.createConnection({
            host: nconf.get('database:host'),
            port: nconf.get('database:port'),
            user: nconf.get('database:user'),
            password: nconf.get('database:password')
        });
        connection.connect();
        console.log('Connected successfully!');
        connection.query('use node');
        
        connection.query('SELECT email FROM user where email = \'' + mail + '\';',
                function(error, result_user_mail, fields) {

                    if (error) {
                        socket.emit('restore_password', {response: 'no'});
                        console.log("Restore password err : " + error);
                        connection.end();
                        return;
                    }

                    if (result_user_mail.length === 0) {
                        socket.emit('restore_password', {response: 'no'});
                        console.log("Restore password err : incorrect email!");
                        connection.end();
                        return;
                    }
                    
                    var code = Math.round(Math.random() * 1500)*533;
                    connection.query('update user set code_for_restore = ' + code +
                        ' where email = \'' + mail + '\';',
                        function(error, result, fields) {

                            connection.end();
                            if (error) {
                                socket.emit('restore_password', {response: 'no'});
                                console.log('Restore password err : something wrong ...');
                                return;
                            }
                            var mailOptions = {
                                from: nconf.get('mail:user'), // sender address
                                to: mail, // list of receivers
                                subject: 'Password restoration', // Subject line
                                text: '', // plaintext body
                                html: 'Your code : <b>' + code + '</b>' // html body
                            };

                            // send mail with defined transport object
                            transporter.sendMail(mailOptions, function(error, info){
                                if(error){
                                    socket.emit('restore_password', {response: 'no'});
                                    console.log(error);
                                }else{
                                    socket.emit('restore_password', {response: 'yes'});
                                    console.log('Message sent: ' + info.response);
                                }
                            });
                        });
                });
    });
    
    socket.on('restore_password_finally', function(data) {
        var mail = data['mail'];
        var code = data['code'];
        var pass = data['pass'];
        console.log('mail ', mail);
        console.log('code ', code);
        console.log('pass ', pass);
        var connection = mysql.createConnection({
            host: nconf.get('database:host'),
            port: nconf.get('database:port'),
            user: nconf.get('database:user'),
            password: nconf.get('database:password')
        });
        connection.connect();
        console.log('Connected successfully!');
        connection.query('use node');
        
        connection.query('SELECT email FROM user where email = \'' + mail 
                        + '\' and code_for_restore = ' + code + ';',
                function(error, result_user_mail, fields) {

                    if (error) {
                        socket.emit('restore_password_finally', {response: 'no'});
                        console.log("Restore password err : " + error);
                        connection.end();
                        return;
                    }

                    if (result_user_mail.length === 0) {
                        socket.emit('restore_password_finally', {response: 'no'});
                        console.log("Restore password err : incorrect email!");
                        connection.end();
                        return;
                    }
                    
                    connection.query('update user set password = ' + pass +
                        ' where email = \'' + mail + '\' and code_for_restore = ' + code + ';',
                        function(error, result, fields) {

                            connection.end();
                            if (error) {
                                socket.emit('restore_password_finally', {response: 'no'});
                                console.log('Restore password err : something wrong ...');
                                return;
                            }
                            var mailOptions = {
                                from: nconf.get('mail:user'), // sender address
                                to: mail, // list of receivers
                                subject: 'Password restoration', // Subject line
                                text: '', // plaintext body
                                html: 'Your password was restored!' // html body
                            };

                            // send mail with defined transport object
                            transporter.sendMail(mailOptions, function(error, info){
                                if(error){
                                    socket.emit('restore_password_finally', {response: 'no'});
                                    console.log(error);
                                }else{
                                    socket.emit('restore_password_finally', {response: 'yes'});
                                    console.log('Message sent: ' + info.response);
                                }
                            });
                        });
                });
    });

    socket.on('author', function(data) {
        var connection = mysql.createConnection({
            host: nconf.get('database:host'),
            port: nconf.get('database:port'),
            user: nconf.get('database:user'),
            password: nconf.get('database:password')
        });
        user = data['user'];
        password = data['password'];
        connection.connect();
        console.log('Connected successfully!');
        connection.query('use node');

        connection.query('SELECT id FROM user where login = \'' + user + '\' and password = \'' + password + '\';',
                function(error, result_user_id, fields) {

                    if (error) {
                        socket.emit('author', {response: 'no'});
                        console.log("Auth err : " + error);
                        return;
                    }

                    if (result_user_id.length === 0) {
                        socket.emit('author', {response: 'no'});
                        console.log("Auth err : incorrect login or password!");
                        return;
                    }

                    console.log("Auth : login = " + user);
                    authStore.user = user;
                    authStore.id_user = result_user_id[0].id;
                    socket.emit('author', {response: 'yes'});
                });

        connection.end();
    });

    socket.on('getUserData', function() {
        //console.log('Get user data');
        var connection = mysql.createConnection({
            host: nconf.get('database:host'),
            port: nconf.get('database:port'),
            user: nconf.get('database:user'),
            password: nconf.get('database:password')
        });
        connection.connect();
        //console.log('Connected successfully!');

        connection.query('use node');
        connection.query('SELECT * FROM score where id_user = ' + sessionStore.id_user + ';',
                function(error, result_user_scores, fields) {
                    if (error) {
                        //TODO: error hanler
                        console.log("Error, while getting user scores : " + error);
                        return;
                    }
                    //console.log('count results ', result_user_scores.length);
                    if (result_user_scores.length === undefined || result_user_scores.length === 0) {

                        connection.query('insert into score (id_user, type_score, score) values(' +
                                '\'' + sessionStore.id_user + '\',\'STD_MUL_WINS\',0),' +
                                '(\'' + sessionStore.id_user + '\',\'STD_MUL_LOSTS\',0);',
                                function(error, res, fields) {
                                    if (error) {
                                        //TODO: error hanler
                                        console.log("Error, while creating user scores : " + error);
                                        return;
                                    }
                                    
                                    socket.emit('user', {username: sessionStore.user});
                                    socket.emit('score', {response: '0'});
                                    socket.emit('wins', {response: '0'});
                                    socket.emit('losts', {response: '0'});
                                    createTopTen(connection, socket);
                                });
                    } else {
                        var score_wins;
                        var score_losts;
                        for (i = 0; i < result_user_scores.length; i++) {
                            if (result_user_scores[i].type_score === 'STD_MUL_WINS') {
                                score_wins = result_user_scores[i].score;
                            }
                            if (result_user_scores[i].type_score === 'STD_MUL_LOSTS') {
                                score_losts = result_user_scores[i].score;
                            }
                        }
                        socket.emit('user', {username: sessionStore.user});
                        socket.emit('score', {response: score_wins - score_losts});
                        socket.emit('wins', {response: score_wins});
                        socket.emit('losts', {response: score_losts});
                        createTopTen(connection, socket);
                    }
                    //console.log('Getting user login : ' + sessionStore.user);
                });
    });

    socket.on('getCrossword', function() {
        Sockets.push(socket);
        if (!sessionStore.user1) {
            socket.emit('redirectToMain');
            return;
        }
        if (!socket.session.username) {
            socket.session.username = sessionStore.user;
            socket.session.id_user = sessionStore.id_user;
            console.log('Socket user in game : ' + socket.session.username);
            console.log('Socket user in game : ' + socket.session.id_user);
        }

        //проставляем счет в 0 для игроков
        for (var i = 0; i < Sockets.length; i++) {
            if ((Sockets[i].session.username === socket.session.username) ||
                    (Sockets[i].session.username === socket.session.userrival)) {
                Sockets[i].session.score = 0;
            }
        }

        if (socket.session.username) {
            console.log('Waiter : ' + sessionStore.user1);
            console.log('Rival : ' + sessionStore.user2);
            if (sessionStore.user1 === socket.session.username) {
                socket.session.userrival = sessionStore.user2;
                socket.emit('yourrival', {username: socket.session.username, rival: sessionStore.user2});
                if (sessionStore.verifyGame) {
                    if (sessionStore.verifyGame === 1) {
                        sessionStore.verifyGame = 2;
                    } else if (sessionStore.verifyGame === 2) {
                        sessionStore.verifyGame = undefined;
                        sessionStore.user1 = undefined;
                        sessionStore.user2 = undefined;
                    }
                }
            }
            if (sessionStore.user2 === socket.session.username) {
                socket.session.userrival = sessionStore.user1;
                socket.emit('yourrival', {username: socket.session.username, rival: sessionStore.user1});
                if (sessionStore.verifyGame) {
                    if (sessionStore.verifyGame === 1) {
                        sessionStore.verifyGame = 2;
                    } else if (sessionStore.verifyGame === 2) {
                        sessionStore.verifyGame = undefined;
                        sessionStore.user1 = undefined;
                        sessionStore.user2 = undefined;
                    }
                }
            }
        }
		var id = sessionStore.crossNum;
		var connection = mysql.createConnection({
            host: nconf.get('database:host'),
            port: nconf.get('database:port'),
            user: nconf.get('database:user'),
            password: nconf.get('database:password')
        });
        connection.connect();
        
        connection.query('use node');
        connection.query('SELECT * FROM crossword where id = ' + id+ ';',
            function(error, result, fields) {
                if (error) {
                    //TODO: error hanler
                    console.log("Error, while getting crossword : " + error);
                    return;
                }
				
                console.log('count results ', result.length);				
				var count_rows = result[0].count_rows;
				var count_columns = result[0].count_columns;
				var count_words = result[0].count_words;
				var id_structure = result[0].id_structure;
				
				socket.session.crossOutedWords = 0;
				socket.session.countWords = count_words;

				socket.emit('data_crossword', {rows: count_rows, 
										  columns: count_columns,
										  words: count_words
										  });
								  
				connection.query('SELECT * FROM structure where id = ' + id_structure+ ';',
                    function(error, res, fields) {
                        if (error) {
                            //TODO: error hanler
                            console.log("Error, while getting structure: " + error);
                            return;
                        }
						var structure = res[0].data;
                        socket.emit('structure_crossword', {cross: structure}); 
                    });
				
				connection.query('SELECT word.word FROM word where id in ('+
								'select id_word from crossword_word where id_crossword = ' + id + ');',
                    function(error, res, fields) {
                        if (error) {
                            //TODO: error hanler
                            console.log("Error, while getting structure: " + error);
                            return;
                        }	
						var words = new Array();
						
						for (var i = 0; i < res.length; i++) {
							words.push(res[i].word);            
						}						
                        socket.emit('words_crossword', {words: words}); 
                    });
																				  
				connection.end();
            });
    });

    socket.on('getRival', function(data) {
        if (!sessionStore.waiter) {
            sessionStore.waiter = sessionStore.user;
            socket.session = {};
            socket.session.username = sessionStore.user;
            socket.session.id_user = sessionStore.id_user;
            console.log('Socket user : ' + socket.session.username);
            console.log('Socket user id : ' + socket.session.id_user);
            SocketsWaiters.push(socket);
        } else {
            console.log('Searching rival ...');
            for (var i = 0; i < SocketsWaiters.length; i++) {
                if (SocketsWaiters[i]) {
                    if (SocketsWaiters[i].session.username) {
                        if (SocketsWaiters[i].session.username == sessionStore.waiter) {
                            if (!sessionStore.user2) {
                                sessionStore.user1 = SocketsWaiters[i].session.username;
                                sessionStore.user2 = sessionStore.user;
                            }
                            console.log('Waiter : ' + sessionStore.user1);
                            console.log('Rival : ' + sessionStore.user2);
                            sessionStore.verifyGame = 1;
                            sessionStore.crossNum = 1;//Math.floor((Math.random() * 2) + 1);
                            console.log('Socket user id : ' + socket.session.id_user);
                            SocketsWaiters[i].emit('rival');
                            console.log('Sending rivals ...');
                            setTimeout(
                                    function() {
                                        socket.emit('rival');
                                        console.log('Rivals sended!');
                                    }, 3000);
                            SocketsWaiters.pop();
                            break;
                        }
                    }
                }
            }
            sessionStore.waiter = undefined;
        }
    });

    socket.on('wordIsFindMe', function(data) {
        cells = data['cells'];
        word = data['word'];

        scoreUser1 = 0;
        scoreUser2 = 0;
        countWords = 0;
        crossOutedWords = 0;

        iUser1 = getSocket(socket.session.username);
        iUser2 = getSocket(socket.session.userrival);

        if (iUser1 !== -1) {
            Sockets[iUser1].session.score++;
            scoreUser1 = Sockets[iUser1].session.score;
            Sockets[iUser1].session.crossOutedWords++;
            crossOutedWords = Sockets[iUser1].session.crossOutedWords;
            countWords = Sockets[iUser1].session.countWords;
            Sockets[iUser1].emit('NewScore', {score: scoreUser1});
        }

        if (iUser2 !== -1) {
            console.log('Sending word from ' + socket.session.username + ' to ' + Sockets[iUser2].session.username);
            scoreUser2 = Sockets[iUser2].session.score;
            Sockets[iUser2].session.crossOutedWords++;
            Sockets[iUser2].emit('wordIsFindOther', {cells: cells, word: word, scoreRival: scoreUser1});
        }

        console.log('crossOutedWords = ' + crossOutedWords);
        console.log('countWords = ' + countWords);
        if (countWords == crossOutedWords) {
            console.log('Game ended!');
            if (scoreUser1 > scoreUser2) {
                socket.emit('you_win');
                console.log('Win ' + socket.session.username + ', rival ' + socket.session.userrival);
                console.log('Win ' + socket.session.id_user + ', rival ' + Sockets[iUser2].session.id_user);
                if (iUser2 !== -1) {
                    console.log('Lose ' + Sockets[iUser2].session.username);
                    Sockets[iUser2].emit('you_lose');
                    updateScoreAfterGame(socket.session.id_user, true);
                    updateScoreAfterGame(Sockets[iUser2].session.id_user, false);
                }
            } else if (scoreUser1 == scoreUser2) {
                if (iUser2 !== -1) {
                    console.log('Sending end game from ' + socket.session.username + ' to ' + Sockets[iUser2].session.username);
                    Sockets[iUser2].emit('endGame');
                    socket.emit('endGame');
                }
            } else {
                socket.emit('you_lose');
                console.log('Lose ' + socket.session.username + ', rival ' + socket.session.userrival);

                if (iUser2 !== -1) {
                    console.log('Win ' + Sockets[iUser2].session.username);
                    Sockets[iUser2].emit('you_win');
                    updateScoreAfterGame(socket.session.id_user, false);
                    updateScoreAfterGame(Sockets[iUser2].session.id_user, true);
                }
            }

            deleteSocketFromArray(socket.session.username);
            deleteSocketFromArray(socket.session.userrival);
        }
    });

    socket.on('userExit', function() {
        console.log('Lose ' + socket.session.username + ', rival ' + socket.session.userrival);

        var iRival = getSocket(socket.session.userrival);
        if (iRival !== -1) {
            console.log('Win ' + Sockets[iRival].session.username);
            Sockets[iRival].emit('you_win_rival_exit');
            updateScoreAfterGame(socket.session.id_user, false);
            updateScoreAfterGame(Sockets[iRival].session.id_user, true);
        }

        deleteSocketFromArray(socket.session.username);
        deleteSocketFromArray(socket.session.userrival);
    });
});

function deleteSocketFromArray(name) {
    for (var i = 0; i < Sockets.length; i++) {
        if (Sockets[i].session.username == name) {
            Sockets.splice(i, 1);
            break;
        }
    }
}

function getSocket(name) {
    for (var i = 0; i < Sockets.length; i++) {
        if (Sockets[i].session.username == name) {
            return i;
        }
    }
    return -1;
}

function updateScoreAfterGame(id_user, is_winner) {
    var connection = mysql.createConnection({
        host: nconf.get('database:host'),
        port: nconf.get('database:port'),
        user: nconf.get('database:user'),
        password: nconf.get('database:password')
    });

    connection.connect();
    console.log('Connected successfully!');
    connection.query('use node');

    try {
        if(is_winner){
            selectAndUpdateScore(connection, id_user, 'STD_MUL_WINS');
        }else{
            selectAndUpdateScore(connection, id_user, 'STD_MUL_LOSTS');
        }
    } catch (err) {
        console.log('Update wins failed with error: ' + err);
    }
}

function selectAndUpdateScore(connection, id_user, type_score) {

    connection.query('SELECT score FROM score where id_user = \'' + id_user + 
                        '\' and type_score = \'' + type_score + '\';',
            function(error, result_score, fields) {
                if (error) {
                    //TODO: error hanler
                    console.log("Error, while getting user id : " + error);
                    connection.end();
                    return;
                }
                var new_user_score = parseInt(result_score[0].score);
                new_user_score++;
                updateScore(connection, id_user, new_user_score, type_score);
            }
    );
}

function updateScore(connection, id_user, new_user_score, type_score) {

    connection.query('update score set score = ' + new_user_score +
            ' where id_user = ' + id_user + ' and type_score = \'' + type_score + '\';',
            function(error, result, fields) {
                
                connection.end();
                if (error) {
                    console.log("Save score err : id_user = " + id_user + ', error = ' + error);
                    return;
                }
                console.log("Save score : user = " + id_user + '.');
            });
}

function createTopTen(connection, socket){
    connection.query('SELECT name, score FROM top_ten;',
            function(error, result_score, fields) {
                connection.end();
                if (error) {
                    //TODO: error hanler
                    console.log("Error, while getting top 10 : " + error);
                    return;
                }
                var result = '<tr>' + 
                                '<td id="td_top_ten_table_top"><h1>user</h1></td>' + 
                                '<td id="td_top_ten_table_top"><h1>score</h1></td>' + 
                                '</tr>';
                for (i = 0; i < result_score.length; i++) {
                    result = result + '<tr>' + 
                                    '<td id="td_top_ten_table"><h2>' + result_score[i].name + '</h2></td>' + 
                                    '<td id="td_top_ten_table"><h2>' + result_score[i].score + '</h2></td>' + 
                                    '</tr>';
                }
                socket.emit('top_ten', { response : result });
            }
    );
}