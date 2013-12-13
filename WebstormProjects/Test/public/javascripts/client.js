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

function getOrWaitRival(){
    //var socket = io.connect('http://localhost:88');
    socket.emit('getRival');
    socket.on('rival', function (data) {
        console.log('Rival found!');
        document.location.href = "/game"
    });
    var $bttn_next= $('#next_page_button');
    $bttn_next.click();
}

function getUserDataAndGoToGame()
{
    //var socket = io.connect('http://localhost');
    socket.emit('getUserData');
    socket.on('user', function (data) {
        document.getElementById('userscore').innerHTML = '0';
        document.getElementById('rivalscore').innerHTML = '0';
    });
    socket.on('score', function (data) {
        my_response = data['response'];
        //document.getElementById('score').innerHTML = 'Your score: ' + my_response + '!';
    });

    socket.emit('getCrossword');
    socket.on('yourrival', function(data){
        my_rival = data['rival'];
        my_name = data['username'];
        document.getElementById('username').innerHTML = my_name;
        document.getElementById('rivalname').innerHTML = my_rival;
    });
    var table = $('#cross-table').empty();

    var table_words= $('#words-table').empty();

    socket.on('crossword', function (data) {
        var cross = data['cross'];
        rows = cross.rows;
        columns = cross.columns;
        var crossword = cross.crossword;
        count_words  = cross.count_words;
        words = cross.words;

        arr_words = words.split(" ");
        for(var i = 1; i < count_words-1; i++) {
            var tr = $('<tr/>');
            tr.append($('<td/>').html(arr_words[i]));
            tr.append($('<td/>').html(arr_words[i+1]));
            tr.append($('<td/>').html(arr_words[i+2]));
            tr.append($('<td/>').html(arr_words[i+3]));
            table_words.append(tr);
            i+=3;
        }

        var arr_rows = crossword.split(" ");

        for(var i = 0; i < rows; i++) {
            var tr = $('<tr/>');
            for(var j = 0; j < columns; j++) {
                tr.append($('<td/>').attr('row', i).attr('column', j).html(arr_rows[i][j]).click(
                    function(){
                        var i = parseInt($(this).attr('row'));
                        var j = parseInt($(this).attr('column'));
                        var v = $(this).html();
                        var reset = false;
                        var cell = {};
                        cell.i = i;
                        cell.j = j;

                        if ($("#cross-table tr:eq("+i+") td:eq("+j+")").hasClass("cellfind"))
                            reset = true;

                        for (var k=0; k<cells.length; k++){
                            if ((parseInt(cells[k].j) == j) && (parseInt(cells[k].i) == i)){
                                reset = true;
                                break;
                            }
                        }

                        if ((!reset) && (cells.length != 0)){
                            reset = true;
                            var k = cells.length - 1 ;
                            var cj = parseInt(cells[k].j);
                            var ci = parseInt(cells[k].i);
                            if (((ci == i) && ((cj + 1  == j) || (cj - 1  == j)))||
                                ((cj == j) && ((ci + 1 == i) || (ci - 1 == i))))
                            {
                                cells.push(cell);
                                word = word.concat(v);
                                $("#cross-table tr:eq("+i+") td:eq("+j+")").addClass("cellselect");
                                reset = false;
                            }
                        }

                        if (reset)
                            resetSelect();

                        if (cells.length == 0){
                            cells.push(cell);
                            word = word.concat(v);
                            $("#cross-table tr:eq("+i+") td:eq("+j+")").addClass("cellselect");
                        }

                        if (isWordInArrWords())
                        {
                            //отправка на сервер слова и координат
                            socket.emit('wordIsFindMe', { word: word, cells: cells});
                            setStyleWord();
                            wordFind();
                        }
                }));
            }
            table.append(tr);
        }
        socket.on('wordIsFindOther', function(data){
            var cs = data['cells'];
            var wd = data['word'];
            alert("Selected word ");
            for (var i=0; i<count_words/4; i++){
                for (var j=0; j<4; j++){
                    if ($("#words-table tr:eq("+i+") td:eq("+j+")").html() == wd)
                        $("#words-table tr:eq("+i+") td:eq("+j+")").addClass("wordfind");
                }
            }

            for (var k=0; k<cs.length; k++){
                var j = parseInt(cs[k].j);
                var i = parseInt(cs[k].i);
                $("#cross-table tr:eq("+i+") td:eq("+j+")").removeClass("cellselect");
                $("#cross-table tr:eq("+i+") td:eq("+j+")").addClass("cellfind");
            }
        });
    });

    var $bttn_next= $('#next_page_button');
    $bttn_next.click();
}

function setStyleWord(){
    for (var i=0; i<count_words/4; i++){
        for (var j=0; j<4; j++){
            if ($("#words-table tr:eq("+i+") td:eq("+j+")").html() == word)
                $("#words-table tr:eq("+i+") td:eq("+j+")").addClass("wordfind");
        }
    }
}

function isWordAlreadyFind(){
    for (var i=0; i<count_words/4; i++){
        for (var j=0; j<4; j++){
            if (($("#words-table tr:eq("+i+") td:eq("+j+")").html() == word) &&
            $("#words-table tr:eq("+i+") td:eq("+j+")").hasClass("wordfind"))
                return true;
        }
    }
    return false;
}

function isWordInArrWords(){
    for (var k=0; k<arr_words.length; k++){
        if((arr_words[k] == word) && (!isWordAlreadyFind()))
            return true;
    }
    return false;
}

function wordFind(){
    for (var k=0; k<cells.length; k++){
        var j = parseInt(cells[k].j);
        var i = parseInt(cells[k].i);
        $("#cross-table tr:eq("+i+") td:eq("+j+")").removeClass("cellselect");
        $("#cross-table tr:eq("+i+") td:eq("+j+")").addClass("cellfind");
    }
    cells  = new Array();
    word= new String();
}

function resetSelect(){
    for (var k=0; k<cells.length; k++){
        var j = parseInt(cells[k].j);
        var i = parseInt(cells[k].i);
        $("#cross-table tr:eq("+i+") td:eq("+j+")").removeClass("cellselect");
    }
    cells  = new Array();
    word= new String();
}


function exit(){
    //var socket = io.connect('http://localhost');
    socket.emit('exit');
    document.location.href = "http://localhost:88"
}

function authorization()
{
    var socket = io.connect('http://localhost');
    var u = document.getElementById('username').value;
    var p = document.getElementById('password').value;
    var signinVal = document.getElementById('signin_submit').value;
    if(signinVal == "Sign in")
    {
        socket.emit('author', { user: u.toString(), password: p.toString() });
        socket.on('author', function (data) {
            my_response = data['response'];
            if (my_response == 'yes'){
                document.location.href = "./main"
            }
            else if (my_response == 'no')
                alert("Incorrect login or password");
        });
    }
    if(signinVal == "Join in!")
    {
        socket.emit('reg', { user: u.toString(), password: p.toString() });
        socket.on('reg', function(data)
        {
            my_response = data['response'];
            if (my_response == 'yes'){
                document.location.href = "./main"
            }
            else if (my_response == 'no')
                alert("Login already exists!");
        });
    }
}

function registration()
{
    document.getElementById('reg_submit').style.display = 'none';
    document.getElementById('signin_submit').value = 'Join in!';
}

function cancelReg()
{
    document.getElementById('signin_submit').value = 'Sign in!';
    document.getElementById('reg_submit').style.display = 'inline';
}

function getUserData()
{
    //var socket = io.connect('http://localhost');
    socket.emit('getUserData');
    socket.on('user', function (data) {
        my_response = data['username'];
        document.getElementById('login').innerHTML = 'Welcome ' + my_response + '!';
    });
    socket.on('score', function (data) {
        my_response = data['response'];
        document.getElementById('score').innerHTML = 'Your score: ' + my_response + '!';
    });
    socket.on('wins', function (data) {
        my_response = data['response'];
        document.getElementById('wins').innerHTML = 'Your wins: ' + my_response + '!';
    });
    socket.on('losts', function (data) {
        my_response = data['response'];
        document.getElementById('losts').innerHTML = 'Your losts: ' + my_response + '!';
    });
}

