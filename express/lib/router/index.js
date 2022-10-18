const url = require('url')
const methods = require('methods')
const Layer = require('./layer')
const Route = require('./route')

function Router() {
    // 路由记录栈
    this.stack = []
}

methods.forEach(method => {
    Router.prototype[method] = function (path,handlers) {
        // this.stack.push({
        //     path,
        //     method,
        //     handler  
        // })
        // const layer = new Layer(path,handler)
        // layer.method = method
        // this.stack.push(layer)
        const route = new Route()
        const layer = new Layer(path,route.dispatch.bind(route))
        layer.route = route
        this.stack.push(layer)
        route[method](path,handlers)
    }
})

Router.prototype.handle= function (req,res) {
    const { pathname } = url.parse(req.url)
    // const method = req.method.toLowerCase()

    let index = 0
    const next = () => {
        if(index >= this.stack.length){
            return res.end(`Can not get ${pathname}`)
        }
        const layer = this.stack[index++]
        const match = layer.match(pathname)
        if(match) {
            req.params = req.params || {}
            Object.assign(req.params, layer.params)
        }
        // 顶层只判定请求路径，内层判定请求方法
        if(match){
            // 顶层这里调用的handler就是dispatch
            return layer.handler(req,res,next)
        }
        next()
    }

    next()

    // const layer = this.stack.find(layer => {
    //     const match = layer.match(pathname)
    //     if(match) {
    //         req.params = req.params || {}
    //         Object.assign(req.params,layer.params)
    //     } 
    //     return match && layer.method === method
    // })
    // if(layer) {
    //     return layer.handler(req,res)
    // }
    // res.end('404 Not Found  ')
}

Router.prototype.use = function (path,handlers){
    if(typeof path === 'function'){
        handlers.unshift(path) // 处理函数
        path = '/'  // 任何路径都以他为开头
    }
    handlers.forEach(handler => {
        const layer = new Layer(path,handler)
        layer.isUserMiddleware = true
        this.stack.push(layer)
    })
}

module.exports = Router