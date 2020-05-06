import "./test.css"
import { goTime, Bojo, Colour } from "./other";

class Test implements Bojo {
    x = Colour.red;
}

console.log(Colour.green);
export function test(name: string) {
    goTime();
    console.log("test");
    document.body.appendChild(document.createTextNode("bob"))
//    document.body.appendChild(test2());
}
