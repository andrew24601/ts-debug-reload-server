const path = require('path');
const fs = require('fs');
const tsconfig = require("./tsconfig");
const ts = require("typescript");

function addExplicitExtension(path) {    
    if (fs.existsSync(path) && path.endsWith(".css")) {
        return path + ".js";
    }
    return path;
}

function fixRelativePath(relativePath) {
    if (relativePath.startsWith(".")) {
        return relativePath;
    } else {
        return "./" + relativePath;
    }
}

exports.transpileFile = function(sourcePath) {
    const folder = path.dirname(sourcePath);
    const config = tsconfig.getConfig(folder);

    function transformBefore(context) {
        const visit = (node) => {
            if (ts.isImportDeclaration(node)) {
                if (node.importClause && node.importClause.isTypeOnly)
                    return undefined;
                const specifier = node.moduleSpecifier.text;
                if (specifier.startsWith(".")) {
                    const target = addExplicitExtension(path.join(folder, specifier));

                    return ts.createImportDeclaration(null, null, node.importClause, ts.createStringLiteral(fixRelativePath(path.relative(folder, target).split('\\').join('/'))));
                } else {
                    const match = tsconfig.resolve(config, specifier);

                    if (match != null) {
                        return ts.createImportDeclaration(null, null, node.importClause, ts.createStringLiteral(fixRelativePath(path.relative(folder, addExplicitExtension(match)).split('\\').join('/'))));
                    }
                }
            }
            return ts.visitEachChild(node, (child) => visit(child), context);
          };
      
          return (node) => ts.visitNode(node, visit);
    }
    
    const source = fs.readFileSync(sourcePath, "utf-8");
    if (config == null) {
        return source;
    }

    let jsxFactory = config.config.compilerOptions.jsxFactory;

    let result = ts.transpileModule(source, {
        fileName: sourcePath,
        compilerOptions: { module: ts.ModuleKind.ES2020, target: "ES2020",
            inlineSourceMap: true,
            inlineSources: true,
            importsNotUsedAsValues: "remove",
            jsx: 2, jsxFactory: jsxFactory ? jsxFactory : "React.createElement" },
        transformers: {
            after: [transformBefore]
        }
    });

    return result.outputText;
}
