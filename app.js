var express = require('express')
, io = require('socket.io')
, app = express.createServer()
, io = io.listen(app);

// Set up the db
var mongo = require('mongoskin');
var dbUrl = process.env.MONGOLAB_URI || 'mongodb://localhost:27017/test?auto_reconnect'

var db = mongo.db(dbUrl);

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
  res.render('board.jade', {board: req.params.board});
})

app.listen(process.env.PORT || 5656);

function insertPoints(board, points) {
  points.forEach(function(rawPoint) {
    //db.collection('points').save({x: point[0], y: point[1], board: board}, {upsert: true});
    var point = {x: rawPoint[0], y: rawPoint[1], board: board}
    console.log("Should be saving ", point)
    db.collection('points').update(point,point,{upsert:true})
    
    // db.collection('points').find({x: point[0], y: point[0], board: board}).toArray(function(err,items) {
    //   if (items.length == 0) {
    //     db.collection('points').save({x: point[0], y: point[1], board: board}, {upsert: true});
    //   }
    // });
  });
}

io.sockets.on('connection', function (socket) {
  // on a join, add them to the right board and save that 
  // property on their socket.
  socket.on('join', function(data) {
    socket.set('board', data.board)
    socket.join(data.board)
    var points = []
    db.collection('points').find({board: data.board}).toArray(function(err, items) {
      items.forEach(function(item) {
        points.push([item.x, item.y])
      })
      socket.emit('draw', {
        points: points
      })
    });
  });

  // On a message, broadcast it to everyone in their board.
  socket.on('draw', function(data) {
    socket.get('board', function(err, board){
      insertPoints(board,data.points)
      socket.broadcast.to(board).emit('draw', data)
    })
  })
});