const pathModule = require('path');
const fs = require('fs')

function parseString(template) {
    const mask = {
        method: null,
        urlRe: /.*/,
        query: {}
    }

    if (/^(\w+)\s/.test(template)) {
        template = template.replace(RegExp.lastMatch, '')
        mask.method = RegExp.$1.toUpperCase()
        if (mask.method === '*' || mask.method === 'ANY') mask.method = null
    }

    if (/\?(.*)$/.test(template)) {
        template = template.replace(RegExp.lastMatch, '')
        mask.query = Object.fromEntries(RegExp.$1.split('&').map(pair => pair.split('=')))
    }

    template = template
        .replace(/\*/g, '.*?')
        .replace(/:(\w+)/g, '(?<$1>[^/]*)')
        .replace(/^\//, '/?')
    mask.urlRe = new RegExp(`^${template}$`)

    return mask
}

function getFiles(dir) {
    const list = []

    fs.readdirSync(dir, {withFileTypes: true})
        .forEach(item => {
            const path = pathModule.resolve(`${dir}/${item.name}`)
            if (item.isDirectory()) list.push(...getFiles(path))
            else list.push(path)
        })

    return list
}

const methodsRe = /^(get|post|put|delete|head|patch|trace|connect|options)\..+/i

function clearCache(mockRoot) {
    mockRoot = pathModule.resolve(mockRoot)
    Object.keys(require.cache)
        .filter(path => path.startsWith(mockRoot))
        .forEach(path => {
            delete require.cache[path]
        })
}

function loadConfig({config, configPath, mockRoot, useFiles}) {
    clearCache(mockRoot)

    // load config from file
    let initialConfig = {}
    try {
        initialConfig = require(configPath)
    } catch (e) {
    }

    if (!initialConfig || typeof initialConfig !== 'object') {
        throw Error('Incorrect APIMocker config')
    }

    // parse config keys to masks
    const entries = initialConfig instanceof Map
        ? Array.from(initialConfig.entries())
        : Object.entries(initialConfig)

    entries.forEach(([key, value]) => {
        config.set(parseString(key), value)
    })

    // create config from files
    if (useFiles) {
        getFiles(mockRoot)
            .filter(path => path !== configPath)
            .forEach(path => {
                const url = path.replace(mockRoot, '').replace(/\.\w+$/, '').replace(/\\/g, '/')
                const method = url.split('/').pop().match(methodsRe)?.[1].toUpperCase() ?? null
                const mask = {
                    ...parseString(url),
                    method,
                    fromFile: true
                }
                config.set(mask, require(path))
            })
    }
}

module.exports = function APIMocker({path = './mocks', useFiles = false}) {
    const config = new Map()

    // resolve path
    const projectRoot = pathModule.resolve('./')
    const configPath = projectRoot + '/' + path
    let mockRoot = pathModule.resolve(configPath)
    const isDirectory = fs.existsSync(mockRoot) && fs.lstatSync(mockRoot).isDirectory()
    if (!isDirectory) mockRoot = pathModule.dirname(mockRoot)

    // load config
    const loaderParams = {config, useFiles, configPath, mockRoot}
    loadConfig(loaderParams)

    // start watch
    fs.watch(mockRoot, {recursive: true}, () => {
        config.clear()
        loadConfig(loaderParams)
    })

    // the bypass function for proxy
    return function mocker(req, res, next) {
        const {method, query, path} = req

        const match = Array.from(config.keys())
            .find(mask => {
                if (mask.method && method !== mask.method) return false

                const isQueryParamsMatch = Object.entries(mask.query)
                    .every(([key, value]) => value == null ? query.hasOwnProperty(key) : query[key] == mask.query[key])
                if (!isQueryParamsMatch) return false

                const result = mask.urlRe.exec(path)

                if (result && result.groups) {
                    Object.assign(req.params, result.groups)
                }

                return result
            })

        if (match) {
            let response = config.get(match)
            if (typeof response === 'function') response = response(req, res, next)
            if (!response) return response

            if (typeof response === 'object') {
                res.setHeader('Content-Type', 'application/json')
                response = JSON.stringify(response)
            }

            res.end(response)
            return true
        }
    }
}
