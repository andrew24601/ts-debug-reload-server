const sucrase = require('./sucrase');
const path = require('path');
const fs = require('fs');
const tsconfig = require("./tsconfig");

function addExplicitExtension(path) {
    if (fs.existsSync(path) && path.endsWith(".css")) {
        return path + ".js";
    }
    if (fs.existsSync(path)) {
        return path;
    }
    if (fs.existsSync(path + ".ts")) {
        return path + ".ts";
    }
    if (fs.existsSync(path + ".js")) {
        return path + ".js";
    }
    if (fs.existsSync(path + ".tsx")) {
        return path + ".tsx";
    }
    return path;
}

exports.transpileFile = function(sourcePath) {
    const folder = path.dirname(sourcePath);
    const config = tsconfig.getConfig(folder);
    const source = fs.readFileSync(sourcePath, "utf-8");
    if (config == null) {
        return source;
    }

    let jsxFactory = config.config.compilerOptions.jsxFactory;

    return sucrase.transform(source, {
        transforms: ["typescript", "jsx"],
        filePath: sourcePath,
        jsxPragma: jsxFactory ? jsxFactory : "React.createElement",
        moduleResolver(name) {
            if (name.startsWith(".")) {
                const target = addExplicitExtension(path.join(folder, name));
                const relativePath = path.relative(folder, target).split('\\').join('/');
                if (relativePath.startsWith(".")) {
                    return relativePath;
                } else {
                    return "./" + relativePath;
                }
            } else {
                const match = tsconfig.resolve(config, name);

                if (match != null) {
                    return path.relative(folder, addExplicitExtension(match)).split('\\').join('/');
                } else {
                    return name;
                }
            }
        }
    }).code;
}
