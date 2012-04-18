var express = require('express')
, io = require('socket.io')
, app = express.createServer()
, io = io.listen(app);
io.set('log level', 1);
app.use(express.static("./public"))

// Set up the db
var mongo = require('mongoskin');
var dbUrl = process.env.MONGOLAB_URI || 'mongodb://localhost:27017/test?auto_reconnect'

var db = mongo.db(dbUrl);
db.collection('boards').ensureIndex({name: 1});
db.collection('boards').ensureIndex({name: 1, time: -1});


io.configure(function () { 
  io.set("transports", ["xhr-polling"]); 
  io.set("polling duration", 10); 
});

app.register('.jade', require('jade'));
app.set('view options', {
  layout: false
})

// Root to index page. Doesn't exist yet.
app.get('/', function(req,res) {
  res.render('index.jade');
});
// /(board) to that board.
app.get('/:board', function(req,res) {
  var title = req.params.board
  title = title.charAt(0).toUpperCase() + title.slice(1);
  res.render('board.jade', {board: req.params.board, title: title});
})

app.listen(process.env.PORT || 5656);


function updateLatestEntry(board, rawPoints, verb) {
  var points = rawPoints.map(function(rawPoint){
    return {x: Math.floor(rawPoint.x), y: Math.floor(rawPoint.y)}
  })
  // Find the latest action on the db
  db.collection('boards').find({name: board}).sort({time: -1}).limit(1).nextObject(function(err,mostRecentAction) {
    if (mostRecentAction && mostRecentAction.verb == verb) {
      db.collection('boards').update({_id: mostRecentAction._id},{$addToSet : {points: {$each: points}}})
    } else {
      db.collection('boards').save({verb:verb, name: board, time: (new Date()).getTime(), points: points})
    }
  })
}

function insertPoints(board, rawPoints) {
  updateLatestEntry(board, rawPoints, 'draw')
}
function removePoints(board, rawPoints) {
  updateLatestEntry(board, rawPoints, 'erase')
}
function removeAllPoints(board) {
  db.collection('boards').remove({name: board})
}

io.sockets.on('connection', function (socket) {
  // on a join, add them to the right board and save that 
  // property on their socket.
  socket.on('join', function(data) {
    db.collection('boards').find({name: data.board}).sort({time: -1})toArray(function(err, actions) {
      if (actions.length == 0) {
        socket.emit('draw', {points:[]})
      }
      actions.forEach(function(action) {
        socket.emit(action.verb, {
          points: action.points
        })
      })
      socket.set('board', data.board)
      socket.join(data.board)
    });
  });

  // On a message, broadcast it to everyone in their board.
  socket.on('draw', function(data) {
    socket.get('board', function(err, board){
      insertPoints(board,data.points)
      socket.broadcast.to(board).emit('draw', data)
    })
  })
  socket.on('erase', function(data) {
    socket.get('board', function(err, board){
      removePoints(board,data.points)
      socket.broadcast.to(board).emit('erase', data)
    })
  })
  socket.on('clear', function(data) {
    socket.get('board', function(err, board){
      removeAllPoints(board)
      socket.broadcast.to(board).emit('clear', data)
    })
  })
});
