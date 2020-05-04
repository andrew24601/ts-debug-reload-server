import "./test.css"
import { goTime, Bojo } from "./other";

console.log("bob")

class Test implements Bojo {
    x = 5;
}

export function test(name: string) {
    goTime();
    console.log("test");
    document.body.appendChild(document.createTextNode("bob"))




//    document.body.appendChild(test2());
}