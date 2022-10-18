const express = require('./express')
const app = express()
const port = 3000

// app.use(function (req,res,next) {
//     res.end('hello')
// })

app.use('/foo',function (req,res,next) {
    res.end('foo')
})

app.get('/',(req,res,next) => {
    console.log('get request1')
    next()
},(req,res,next) => {
    console.log('get request2')
    next()
},(req,res,next) => {
    console.log('get request2')
    next()
})

app.get('/',(req,res,next) => {
    res.end('get')
})

app.get('/ab*cd',(req,res) => {
    res.end('get about')
})

app.get('/users/:userId/books/:bookId',function (req,res) {
    console.log(req.params)
    res.end('/users/:userId/books/:bookId')
})

app.get('/foo',(req,res,next) => {
    console.log("foo1")
    setTimeout(() => {
        next()
    }, 1000);
})

app.get('/foo',(req,res,next) => {
    console.log("foo2")
    next()
})

app.get('/foo',(req,res) => {
    res.end('get /foo')
})

app.post('/',(req,res) => {
    res.end('post request')
})

app.delete('/',(req,res) => {
    res.end('delete request')
})

// console.log(app._router)

app.listen(port, () => {
  console.log(`Example app listening on port port`)
})