# api-mocker
The api mock middleware that allows to serve local files as responses to intercepted api calls.
Ideally feats to webpack-dev-server like Angular [proxy server](https://angular.io/guide/build#proxying-to-a-backend-server).

### features

🔥 Built in support for hot mocks replacement  
🚀 Quickly and easily configure the API via JSON  
📂 Or using the mock files structure

# Installation

```shell
npm install api-mocker --save-dev
```

# Bypass function

Call `APIMocker()` function to get the pre-configured bypass function.

There is object with two parameters, that you can pass to :

* `path` - specifies path to config file or all mocks root folder, by default `./mocks`
* `useFiles` - boolean flag that allows adding the mock files to configuration, by default `false`

# Files based usage

Put your JSON files in folder, for example `./mocks`:
```shell
./mocks
    /api
        /users.json
        /goods.json
```

And add proxy configuration `proxy.config.js` (for Angular application):
```javascript
const APIMocker = require('api-mocker')

module.exports = [{
    context: () => true,
    target: 'https://your.domain',
    bypass: APIMocker({path: './mocks', useFiles: true}),
}]
```

Or put it into `devServer.proxy` section into your [webpack config](https://webpack.js.org/configuration/dev-server/#devserverproxy).

That's it!

When you'll perform requests to `/api/users` or `/api/goods`,
the proxy server will intercept it and return JSON from existed files.
All other requests will be passed to your back-end.

To distinguish different HTTP methods, just call the files with according prefix:
```shell
./mocks/api
    /get.users.json
    /post.users.json
```

# Config based usage

The same as previous, but put to `./mocks` folder the `index.js` file, that returns an object
describes the configuration:

```javascript
module.exports = {
    'get /api/users': require('./api/get.users.json'),
    'post /api/users': require('./api/post.users.json'),
    '/api/goods': [
        {id: 1, price: 100.00, title: 'Sample'},
        {id: 2, price: 99.99, title: 'Worse'}
    ],
    '/api/goods/:id': function(req, res) {
        const {id} = req.params
        if (id === '1' || id === '2') {
            res.end(JSON.stringify({status: 'Found!'}))
        } else {
            res.statusCode = 400
            res.end('Bad Request')
        }
    }
}
```

### The key string format

```text
method /path/:param/*?query=value
```

#### Method

The method is case-insensitive. It can be one of HTTP methods like `GET` or `POST`.
Or it can be `ANY` or `*` or just omit it to match with any request methods.

#### Path

The path describes the part or URL that can contain wildcards and parameters.

Wildcard `*` in a path matches any substring.

Params allows you to deal with dynamics URLs and you can get an according value from the `req.params`.

#### Query params

It is possible to filter requests by query parameters.
You can use only parameter name to check if it exists: `?param`.
Or check full coincidence for a name and value: `?param=value`.

### Responses

There are three types of responses: strings, objects and function.

The strings will be returned as is.

The objects will be translated to string and returned with the `Content-type: application/json` header.

#### The functions

The functions can fully manage the request and response with according parameters.

If you need to pass the request to back-end just return `null` or `undefined` from the function.

But there is one difference with webpack-dev-server bypass function.
You cannot return the path to the file to return it as response.
Please, use `require` or other ways to get the response content and return the content.

---

Please, check the [api-mocker-middleware](https://www.npmjs.com/package/api-mocker-middleware) if you are using the Express server.