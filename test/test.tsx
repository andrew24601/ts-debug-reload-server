import usx from "usx";

export function test() {
    let time = null;

    setInterval(()=>{
        time = new Date().toTimeString();
        usx.update();
    }, 1000);

    return <div>Helloes world {()=>time}</div>
}

export function test2() {
    return <a href="#">Go here</a>
}