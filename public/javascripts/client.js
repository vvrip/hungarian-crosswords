/**
 * Created with JetBrains WebStorm.
 * User: Galya
 * Date: 03.11.13
 * Time: 20:04
 * To change this template use File | Settings | File Templates.
 */

var rows;
var columns;
var arr_words;
var count_words;
var cells = Array();
var word = new String();
var crossOutedWords;

function getOrWaitRival() {
    socket.emit('getRival');
    socket.on('rival', function(data) {
        console.log('Rival found!');
        document.location.href = "/game"
    });
    var $bttn_next = $('#next_page_button');
    $bttn_next.click();
}

function getUserDataAndGoToGame()
{
    socket.emit('getUserData');

    socket.on('user', function(data) {
        document.getElementById('userscore').innerHTML = '0';
        document.getElementById('rivalscore').innerHTML = '0';
    });

    socket.emit('getCrossword');
    socket.on('yourrival', function(data) {
        my_rival = data['rival'];
        my_name = data['username'];
        document.getElementById('username').innerHTML = my_name;
        document.getElementById('rivalname').innerHTML = my_rival;
    });
    socket.on('redirectToMain', function(data) {
        document.location.href = "/main"
    });
    var table = $('#cross-table').empty();

    var table_words = $('#words-table').empty();

	socket.on('data_crossword', function(data) {
		rows = data['rows'];
        columns = data['columns'];        
        count_words = data['words'];			
	});
	
    socket.on('structure_crossword', function(data) {
        var crossword = data['cross'];    
		var arr_rows = crossword.split(' ');		
        for (var i = 0; i < rows; i++) {
            var tr = $('<tr/>');
            for (var j = 0; j < columns; j++) {
                tr.append($('<td/>').attr('row', i).attr('column', j).html(arr_rows[i][j]).click(
                    function() {
                        var i = parseInt($(this).attr('row'));
                        var j = parseInt($(this).attr('column'));
                        var v = $(this).html();
                        var reset = false;
                        var cell = {};
                        cell.i = i;
                        cell.j = j;

                        if ($("#cross-table tr:eq(" + i + ") td:eq(" + j + ")").hasClass("cellfind"))
                            reset = true;

                        for (var k = 0; k < cells.length; k++) {
                            if ((parseInt(cells[k].j) == j) && (parseInt(cells[k].i) == i)) {
                                reset = true;
                                break;
                            }
                        }

                        if ((!reset) && (cells.length != 0)) {
                            reset = true;
                            var k = cells.length - 1;
                            var cj = parseInt(cells[k].j);
                            var ci = parseInt(cells[k].i);
                            if (((ci == i) && ((cj + 1 == j) || (cj - 1 == j))) ||
                                ((cj == j) && ((ci + 1 == i) || (ci - 1 == i))))
                            {
                                cells.push(cell);
                                word = word.concat(v);
                                $("#cross-table tr:eq(" + i + ") td:eq(" + j + ")").addClass("cellselect");
                                reset = false;
                            }
                        }

                        if (reset)
                            resetSelect();

                        if (cells.length == 0) {
                            cells.push(cell);
                            word = word.concat(v);
                            $("#cross-table tr:eq(" + i + ") td:eq(" + j + ")").addClass("cellselect");
                        }

                        if (isWordInArrWords())
                        {
                            //отправка на сервер слова и координат
                            socket.emit('wordIsFindMe', {word: word, cells: cells});

                            setStyleWord();
                            wordFind();

                            socket.on('NewScore', function(data) {
                                //мен€ем счет 								
                                document.getElementById('userscore').innerHTML = data['score'];
                            });
                        }
                    }));
            }
            table.append(tr);
		}
    });

		socket.on('words_crossword', function(data) {
			arr_words = data['words'];				
			for (var i = 0; i < count_words; i++) {
				var tr = $('<tr/>');				
				tr.append($('<td/>').html(arr_words[i]));
				tr.append($('<td/>').html(arr_words[i + 1]));
				tr.append($('<td/>').html(arr_words[i + 2]));
				tr.append($('<td/>').html(arr_words[i + 3]));
				table_words.append(tr);
				i += 4;
			}
		});
		
        socket.on('you_win', function() {
            alert('Congratulations! You\'re winner!');
            document.location.href = "/main";
        });

        socket.on('you_win_rival_exit', function() {
            alert('Congratulations! You\'re winner! Your enemy left the game.');
            document.location.href = "/main";
        });

        socket.on('you_lose', function() {
            alert('You\'re loser.');
            document.location.href = "/main";
        });

        socket.on('wordIsFindOther', function(data) {
            var cs = data['cells'];
            var wd = data['word'];

            var usl = false;
            for (var i = 0; i < count_words / 4; i++) {
                for (var j = 0; j < 4; j++) {
                    if (($("#words-table tr:eq(" + i + ") td:eq(" + j + ")").html() == wd) &&
                            $("#words-table tr:eq(" + i + ") td:eq(" + j + ")").hasClass("wordfind"))
                    {
                        usl = true;
                        break;
                    }
                }
            }
            if (!usl) {
                for (var i = 0; i < count_words / 4; i++) {
                    for (var j = 0; j < 4; j++) {
                        if ($("#words-table tr:eq(" + i + ") td:eq(" + j + ")").html() == wd)
                            $("#words-table tr:eq(" + i + ") td:eq(" + j + ")").addClass("wordfind");
                    }
                }

                for (var k = 0; k < cs.length; k++) {
                    var j = parseInt(cs[k].j);
                    var i = parseInt(cs[k].i);
                    $("#cross-table tr:eq(" + i + ") td:eq(" + j + ")").removeClass("cellselect");
                    $("#cross-table tr:eq(" + i + ") td:eq(" + j + ")").addClass("cellfind");
                }

                var score = data['scoreRival'];
                document.getElementById('rivalscore').innerHTML = score;
            }
        });
    

    var $bttn_next = $('#next_page_button');
    $bttn_next.click();
}

function setStyleWord() {
    for (var i = 0; i < count_words / 4; i++) {
        for (var j = 0; j < 4; j++) {
            if ($("#words-table tr:eq(" + i + ") td:eq(" + j + ")").html() == word)
                $("#words-table tr:eq(" + i + ") td:eq(" + j + ")").addClass("wordfind");
        }
    }
}

function isWordAlreadyFind() {
    for (var i = 0; i < count_words / 4; i++) {
        for (var j = 0; j < 4; j++) {
            if (($("#words-table tr:eq(" + i + ") td:eq(" + j + ")").html() == word) &&
                    $("#words-table tr:eq(" + i + ") td:eq(" + j + ")").hasClass("wordfind"))
                return true;
        }
    }
    return false;
}

function isWordInArrWords() {
    for (var k = 0; k < arr_words.length; k++) {
        if ((arr_words[k] == word) && (!isWordAlreadyFind()))
            return true;
    }
    return false;
}

function wordFind() {
    for (var k = 0; k < cells.length; k++) {
        var j = parseInt(cells[k].j);
        var i = parseInt(cells[k].i);
        $("#cross-table tr:eq(" + i + ") td:eq(" + j + ")").removeClass("cellselect");
        $("#cross-table tr:eq(" + i + ") td:eq(" + j + ")").addClass("cellfind");
    }
    cells = new Array();
    word = new String();
}

function resetSelect() {
    for (var k = 0; k < cells.length; k++) {
        var j = parseInt(cells[k].j);
        var i = parseInt(cells[k].i);
        $("#cross-table tr:eq(" + i + ") td:eq(" + j + ")").removeClass("cellselect");
    }
    cells = new Array();
    word = new String();
}


function exit() {
    document.location.href = "http://localhost:88/exit";
}

function exitFromGame() {
    socket.emit('userExit');
    document.location.href = "http://localhost:88/main";
}

function authorization()
{
    var socket = io.connect('http://localhost:88');
    var u = document.getElementById('username').value;
    var p = document.getElementById('password').value;
    var signinVal = document.getElementById('signin_submit').value;
    if (signinVal == "Sign in")
    {
        socket.emit('author', {user: u.toString(), password: p.toString()});
        socket.on('author', function(data) {
            my_response = data['response'];
            if (my_response == 'yes') {
                document.location.href = "./main"
            }
            else if (my_response == 'no')
                alert("Incorrect login or password");
        });
    }
    if (signinVal == "Join in!")
    {
        socket.emit('reg', {user: u.toString(), password: p.toString()});
        socket.on('reg', function(data)
        {
            my_response = data['response'];
            if (my_response == 'yes') {
                document.location.href = "./main"
            }
            else if (my_response == 'no')
                alert("Login already exists!");
        });
    }
    if (signinVal == "Restore!")
    {
        socket.emit('restore_password', {mail: u.toString()});
        socket.on('restore_password', function(data)
        {
            my_response = data['response'];
            if (my_response == 'yes') {
                document.location.href = "./restore"
            }
            else if (my_response == 'no')
                alert("Your e-mail is incorrect!");
        });
    }    
}

function registration()
{
    document.getElementById('reg_submit').style.display = 'none';
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    document.getElementById('signin_submit').value = 'Join in!';
    document.getElementById('form_main_title').innerHTML = 'Please enter login and password for registration';
}

function restorePassword()
{
    document.getElementById('label_password').innerHTML = ' ';
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    document.getElementById('label_password').style.padding = '9px';
    document.getElementById('password').style.display = 'none';
    document.getElementById('reg_submit').style.display = 'none';
    document.getElementById('restore_pass_submit').style.display = 'none';
    document.getElementById('empty_block').style.display = 'inline';    
    document.getElementById('signin_submit').value = 'Restore!';
    document.getElementById('form_main_title').innerHTML = 'Please enter your e-mail for restore password';
    document.getElementById('label_username').innerHTML = 'e-mail:';
}

function cancelReg()
{
    document.getElementById('label_password').innerHTML = 'Password';
    document.getElementById('label_password').style.padding = '0px';
    document.getElementById('password').style.display = 'inline';
    document.getElementById('reg_submit').style.display = 'inline';
    document.getElementById('restore_pass_submit').style.display = 'inline';
    document.getElementById('empty_block').style.display = 'none';   
    document.getElementById('signin_submit').value = 'Sign in!';
    document.getElementById('form_main_title').innerHTML = 'Please verify your account before continue';
    document.getElementById('label_username').innerHTML = 'Username ';
}

function getUserData()
{
    socket.emit('getUserData');
    socket.on('user', function(data) {
        my_response = data['username'];
        document.getElementById('login').innerHTML = 'Welcome ' + my_response + '!';
    });
    socket.on('score', function(data) {
        my_response = data['response'];
        document.getElementById('score').innerHTML = 'Your score: ' + my_response + '!';
    });
    socket.on('wins', function(data) {
        my_response = data['response'];
        document.getElementById('wins').innerHTML = 'Your wins: ' + my_response + '!';
    });
    socket.on('losts', function(data) {
        my_response = data['response'];
        document.getElementById('losts').innerHTML = 'Your losts: ' + my_response + '!';
    });
    socket.on('top_ten', function(data) {
        document.getElementById('top_ten_table').innerHTML = data['response'];
    });
}

function restorePasswordFinally()
{  
    var mail = document.getElementById('email').value;
    var code = document.getElementById('code').value;    
    var pass = document.getElementById('password').value;
    var pass2 = document.getElementById('repeat_password').value;
    if(pass !== pass2){
        alert('Passwords are different!');
        return;
    }
    var socket = io.connect('http://localhost:88');
    socket.emit('restore_password_finally', {mail: mail, code: code, pass: pass});
    socket.on('restore_password_finally', function(data)
    {
        my_response = data['response'];
        if (my_response === 'yes') {
            document.location.href = "/";
        }
        else if (my_response === 'no')
            alert("Your e-mail or/and code are incorrect!");
    });
}

