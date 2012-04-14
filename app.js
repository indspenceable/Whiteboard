var mongo = require('mongodb');

mongo.connect(process.env.MONGOLAB_URL, {}, function(error, db) {
  var express = require('express');
  var io = require('socket.io');
  var app = express.createServer()
  , io = io.listen(app);

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
    points.forEach(function(point) {
      if (db.points.find({x: point[0], y: point[0], board: board}).length == 0) {
        // Add it
        db.points.save({x: point[0], y: point[0], board: board})
      }
    })
  }


  io.sockets.on('connection', function (socket) {
    // on a join, add them to the right board and save that 
    // property on their socket.
    socket.on('join', function(data) {
      socket.set('board', data.board)
      socket.join(data.board)
      socket.emit('draw', {
        points: db.points.find({board: data.board}).map(function(pt) {
          [pt.x, pt.y]
        })
      })
    });

    // On a message, broadcast it to everyone in their board.
    socket.on('draw', function(data) {
      socket.get('board', function(err, board){
        insertPoints(board,data.points)
        socket.broadcast.to(board).emit('draw', data)
      })
    })
  });
});