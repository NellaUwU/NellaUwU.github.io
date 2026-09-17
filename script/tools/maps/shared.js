export class Project {
    constructor(id) {
        this.pId = id;
        this.nodes = new Map();
        this.project = localStorage.getItem(`maps/projects/${this.pId}`);
        return this.project;
    }
    reload() {
        this.project = localStorage.getItem(`maps/projects/${this.pId}`);
        return this.project;
    }
    save(stringify = true) {
        const data = this.project;
        console.log(this.project);
        if (stringify) localStorage.setItem(`maps/projects/${this.pId}`, JSON.stringify(data));
        else           localStorage.setItem(`maps/projects/${this.pId}`, data);
        //console.error("SAVING..", stringify, this.project);
    }
    get() {
        return JSON.parse(this.project);
    }
    saveNode(elem, local = true) {
        const id = elem.getAttribute("nodeId");
        const data = this.nodes.get(id);
        console.log(data);
        //console.log(elem.querySelector(".body").textContent);
        data.json.body = elem.querySelector(".body").textContent ?? "";
        this.nodes.set(id, data);
        if (local) {
            this.project.nodes = Array.from(this.nodes);
            this.save();
        }
    }
    saveAllNodes() {
        this.nodes.forEach(node => {
            //console.log(node);
            this.saveNode(node.nodeElem, false);
        });
        if (typeof this.project === "string") this.project = JSON.parse(this.project);
        let n = [];
        this.nodes.forEach(m => {
            console.log(m);
            // const j = m.json[1].json;
            // j.id = m.json[0];
            const j = m.json;
            j.id = m.json.id;
            n.push(j);
        });
        this.project.nodes = n;
        this.save(true);
    }
    deleteNode(elem) {
        const id = elem.getAttribute("nodeId");
        this.nodes.delete(id);
    }
    createNode(elem, data) {
        const id = this.generateId();
        elem.setAttribute("nodeId", id);
        this.nodes.set(id, data);
        return id;
    }
    generateId() {
        let id;
        do {
            if (crypto.randomUUID) {
                id = crypto.randomUUID();
            } else {
                id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            }
        } while (this.nodes.has(id));
        return id;
    }
};
console.log(JSON.stringify({
        pos: {
            x: 300,
            y: 150
        },
        color: "#F5A9B8",
        head: "Test Node",
        body: ""
    }));
const test = "{\"name\":\"New Project #0\",\"color\":\"#d8b989\",\"nodes\":[{\"pos\":{\"x\":300,\"y\":150},\"color\":\"#F5A9B8\",\"head\":\"Test Node\",\"body\":\"\"}]}";
console.log(JSON.parse(test));