import "./test.css"
import {test2} from "./test";

console.log("bob")

export function test(name: string) {
    console.log("test");
    document.body.appendChild(document.createTextNode("bob"))

    document.body.appendChild(test2());
}