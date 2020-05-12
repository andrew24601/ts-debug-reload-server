const path = require('path');
const fs = require('fs');
const ts = require("typescript");
const tsConfigPaths = require("./tsconfig-paths");

function addExplicitExtension(path) {    
    if (fs.existsSync(path) && path.endsWith(".css")) {
        return path + ".js";
    }
    if (fs.existsSync(path + ".js")) {
        return path + ".js";
    }
    if (fs.existsSync(path + "/index.ts")) {
        return path + "/index";
    }
    if (fs.existsSync(path + "/index.js")) {
        return path + "/index.js";
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
    const config = tsConfigPaths.loadConfig(folder);
    const matcher = config.resultType === "success" ? tsConfigPaths.createMatchPath(config.absoluteBaseUrl, config.paths, ["module", "main"]) : null;

    function transformBefore(context) {
        const visit = (node) => {
            if (ts.isImportDeclaration(node)) {
                if (node.importClause && node.importClause.isTypeOnly)
                    return undefined;
                const specifier = node.moduleSpecifier.text;
                if (specifier.startsWith(".")) {
                    if (specifier.endsWith(".css")) {
                        return ts.createImportDeclaration(null, null, node.importClause, ts.createStringLiteral(specifier+".js"));
                    }
                } else if (matcher != null) {
                    const match = matcher(specifier, undefined, undefined, [".ts", ".tsx", ".js"]);

                    if (match != null) {
                        return ts.createImportDeclaration(null, null, node.importClause, ts.createStringLiteral(fixRelativePath(path.relative(folder, addExplicitExtension(match)).split('\\').join('/'))));
                    }
                }
            } else if (ts.isExpressionStatement(node)) {
                /* Automatically elide assignment to __webpack_public_path__ */
                const expr = node.expression;
                if (ts.isBinaryExpression(expr)) {
                    if (expr.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
                        const left = expr.left;
                        if (ts.isIdentifier(expr.left)) {
                            if (left.text === "__webpack_public_path__")
                                return null
                        }
                    }
                }
                return node;
            }
            return ts.visitEachChild(node, (child) => visit(child), context);
          };
      
          return (node) => ts.visitNode(node, visit);
    }
    
    const source = fs.readFileSync(sourcePath, "utf-8");

    let jsxFactory = "React.createElement";
    if (config.jsxFactory) {
        jsxFactory = config.jsxFactory;
    }

    let result = ts.transpileModule(source, {
        fileName: sourcePath,
        compilerOptions: { module: ts.ModuleKind.ES2020, target: "ES2020",
            inlineSourceMap: true,
            inlineSources: true,
            importsNotUsedAsValues: "remove",
            jsx: 2,
            jsxFactory
        },
        transformers: {
            after: [transformBefore]
        }
    });

    return result.outputText;
}
