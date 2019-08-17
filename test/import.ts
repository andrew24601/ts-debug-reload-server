import "./test.css"

console.log("bob")

export function test(name: string) {
    console.log("test");
    document.body.appendChild(document.createTextNode("bob"))
}