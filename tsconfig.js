const path = require('path');
const fs = require('fs');
const JSON5 = require('json5');

exports.getConfig = function(folder) {
    do {
        const configPath = path.resolve(folder, 'tsconfig.json');
        if (fs.existsSync(configPath)) {
            const config = JSON5.parse(fs.readFileSync(configPath, "utf-8"));
            let baseUrl;
            if (config.compilerOptions.baseUrl !== undefined) {
                baseUrl = path.resolve(folder, config.compilerOptions.baseUrl);
            } else {
                baseUrl = folder;
            }
            return {
                folder,
                baseUrl,
                config
            }
        }
    
        const parent = path.dirname(folder);
        if (parent === folder)
            break;
        folder = parent;
    } while (true);
}

function tryResolve(pattern, paths, baseUrl, name) {
    let matched;
    if (pattern === "*") {
        matched = name;
    } else if (pattern.endsWith("*")) {
        if (!name.startsWith(pattern.substring(0, pattern.length - 1)))
            return null;
        matched = name.substring(pattern.length - 1);
    } else {
        if (name !== pattern) {
            return null;
        }
        matched = "";
    }

    for (const p of paths) {
        let resolved;
        if (p === "*") {
            resolved = path.resolve(baseUrl, matched);
        } else if (p.endsWith("*")) {
            resolved = path.resolve(baseUrl, p.substring(0, p.length - 1), matched);
        } else {
            resolved = path.resolve(baseUrl, p);
        }

        if (fs.existsSync(resolved + ".ts")) {
            return resolved;
        }
        if (fs.existsSync(resolved + ".tsx")) {
            return resolved;
        }
        if (fs.existsSync(resolved + "/index.ts")) {
            return resolved + "/index";
        }
        if (fs.existsSync(resolved + "/index.js")) {
            return resolved + "/index.js";
        }
        if (fs.existsSync(resolved + "/index.tsx")) {
            return resolved + "/index";
        }

        const packagePath = path.resolve(resolved, "package.json");
        if (fs.existsSync(packagePath)) {
            const package = JSON5.parse(fs.readFileSync(packagePath, "utf-8"));
            if (package.module !== undefined) {
                return path.resolve(resolved, package.module);
            }
            if (package.main !== undefined) {
                return path.resolve(resolved, package.main);
            }
        }
    }
    return null;
}

exports.resolve = function(loaded, path) {
    const config = loaded.config;
    if (config.compilerOptions.paths) {
        for (const k in config.compilerOptions.paths) {
            const paths = config.compilerOptions.paths[k];
            const resolved = tryResolve(k, paths, loaded.baseUrl, path);
            if (resolved != null) {
                return resolved;
            }
        }
    }
    return null;
}