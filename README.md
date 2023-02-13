# My-Express
express源码

+ express启动的时候，会去express文件下的package.json中找main调用路径，如果没有设置main，则会默认将index.js设置为文件入口

+ index.js中主要就是将lib中的模块进行导出

+ lib

## express.js

+ 在express.js中主要是负责导出app函数以及它内置的一些方法数据，而这些方法数据是通过mixin来进行混入的
+ 在express中主要是对app上的路由以及res，req等进行一个设置，创建一个app函数的时候给它附上request和response来完成对app的初始化

    
  
    ```js
    function createApplication() {
      var app = function(req, res, next) {
        app.handle(req, res, next);
      };
    
      mixin(app, EventEmitter.prototype, false);
      mixin(app, proto, false);
    
      // expose the prototype that will get set on requests
      app.request = Object.create(req, {
        app: { configurable: true, enumerable: true, writable: true, value: app }
      })
    
      // expose the prototype that will get set on responses
      app.response = Object.create(res, {
        app: { configurable: true, enumerable: true, writable: true, value: app }
      })
    
      app.init();
      return app;
    }
    ```


​    

​    

## application.js

+ 主要负责app中的成员方法，比如app.use，app.get此类的方法
+ 在添加与路由相关的方法的时候，使用methods第三方库来帮助我们完成对app中的路由成员方法的添加
+ **注意**：在application中并不会直接去处理相关router的handlers函数，而是交给App下的隐藏属性`_router`，而我们只需要对`_router`它的原型方法`Router`进行相关handlers函数的处理

```js

const http = require('http')
const Router = require('./router')
const methods = require('methods')

function App () {
    this._router = new Router()
    // this.routes = []
}

// console.log(methods)
methods.forEach(method => {
    App.prototype[method] = function (path,...handlers) {
        this._router[method](path,handlers)
    }
})

App.prototype.use = function (path,...handlers){
    this._router.use(path,handlers)
}

App.prototype.listen = function(...args) {
    const server = http.createServer((req,res) => {
        this._router.handle(req,res)   
    })
    server.listen(...args)
}    

module.exports = App
```


​    

## Router

+ Router中主要就是负责路由参数的处理以及对应handlers的处理，他们分别对应着`layer`和`route`，然后，在layer的属性上添加上route，再对其保存到stack记录栈中，最后，注意调用route方法

```js
methods.forEach(method => {
    Router.prototype[method] = function (path,handlers) {
        const route = new Route()
        const layer = new Layer(path,route.dispatch.bind(route))
        layer.route = route
        this.stack.push(layer)
        route[method](path,handlers)
    }
})
```



+ Router中还有handle方法，该方法主要是用来完成next参数的递归

```js
Router.prototype.handle= function (req,res) {
    const { pathname } = url.parse(req.url)
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
}
```



+ Router中还有use方法，该方法主要是用来处理函数，也可以用来处理路由，多数处理函数中间件

```js
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
```



### Layer

+ Layer函数主要是用来处理路由参数，而该函数的原型上的match方法就是用来验证路由函数

```js
function Layer (path,handler) {
    this.path = path
    this.handler = handler
    this.keys = []
    this.regexp = pathRegexp(path,this.keys,{})
    this.params = {}
}
```



+ 常见的路由path以及参数params一般会保存到Layer中，以及他们对应的handler
+ 有需要特殊处理的参数如正则，则是使用了`path-to-regexp`第三方库来完成对正则的匹配验证，**注意当前`path-to-regexp`的版本需要指定为0.1.7**
+ 参数的校验是通过match循环获得path路径上的参数，然后将其赋值给Layer下的params属性
+ 注意：校验的过程中也需要对use方法进行校验（use方法也能是路由），因此在use方法创建的过程中会在Layer上添加上标记`isUserMiddleware`，则在校验的时候只需要判断下`isUserMiddleware`即可标识use方法，再对其进行具体的判断

```js
Layer.prototype.match = function (pathname) {
    const match = this.regexp.exec(pathname)
    if(match) {
        this.keys.forEach((key,index) => {
            this.params[key.name] = match[index + 1]
        })
        return true
    }

    if(this.isUserMiddleware) {
        if(this.path === '/'){
            return true
        }
        if(pathname.startsWith(`${this.path}/`)){
            return true
        }
    }

    return false    
}
```



### Route

+ Route主要是用来调用路由对象中所有的处理函数，并且，Route本身也是有记录栈stack的
+ 当前的记录栈是用来记录layer参数，在每个Route中的method中，Layer中保存不同的method来做区分

```js
methods.forEach(method => {
    Route.prototype[method] = function (path,handlers) {
        handlers.forEach(handler => {
            const layer = new Layer(path,handler)
            layer.method = method
            this.stack.push(layer)
        })
    }
})
```



+ Route中dispatch用来执行当前路由所有的处理对象，需要注意的是当前路由对象上可能不止一个处理函数，所以这里的next实际意义是是out，即跳出当前函数，到下一个函数中执行，
+ 这里的next执行主要是使用递归的方法，对当前记录栈中的layer挨个做匹配，如果method相同，即匹配正确则调用处理函数，然后out，去执行下一个函数，`递归的中止器是index`

```js
// 遍历执行当前路由对象中所有的处理函数
Route.prototype.dispatch = function (req,res,out) {
    // 遍历内层的stack
    let index = 0
    const method = req.method.toLowerCase()
    const next = () => {
        if(index >= this.stack.length) return out()
        const layer = this.stack[index++]
        if(layer.method === method){
            return layer.handler(req,res,next)
        }
        next()
    }
    next()
}
```
