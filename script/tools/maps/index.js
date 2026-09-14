import { addHoldEventListener, alertJson, generateRandomHex, materialIcon } from "/script/shared.js";
const body = document.body;
const nav = document.createElement("nav");
const main = document.createElement("main");
const wrapper = document.createElement("div");
const edit = document.createElement("div");
wrapper.classList.add("wrapper");
edit.classList.add("editMenu");
edit.addEventListener("click", e => {
    if (e.target != edit) return;
    edit.classList.remove("open");
});
main.appendChild(wrapper);
main.appendChild(edit);
body.appendChild(nav);
body.appendChild(main);
if (!Array.isArray(JSON.parse(localStorage.getItem("maps/projects"))))
    localStorage.setItem("maps/projects", JSON.stringify([]));

function createNewProject() {
    let projects = JSON.parse(localStorage.getItem("maps/projects"));
    let id = 0;
    console.log(projects);
    while (projects.includes(`${id}`)) id++;
    projects.push(`${id}`);
    console.log(id);
    const name = prompt("Name: ", `New Project #${id}`);
    const color = generateRandomHex();
    const data = {
        name: name,
        color: color
    };
    localStorage.setItem(`maps/projects/${id}`, JSON.stringify(data));
    localStorage.setItem("maps/projects", JSON.stringify(projects));
    updateProjects();
}
function editProject(data) {
    //alertJson(data)
    const editMenu = edit.querySelector(".menu");
    const name = editMenu.querySelector(".name");
    const colorInp = editMenu.querySelector(".colors > .inp");
    const colorHex = editMenu.querySelector(".colors > .hex");
    const buttons = editMenu.querySelector(".actions");
    edit.classList.add("open");
    edit.setAttribute("project-id", data.id);
    name.value = data.name;
    colorInp.value = data.color;
    colorHex.value = data.color.slice(1);
}
function updateProjects() {
    wrapper.innerHTML = "";
    wrapper.appendChild(loadProjects());
}
function loadProjects() {
    const projects = JSON.parse(localStorage.getItem("maps/projects")) ?? [];
    const res = document.createElement("ul");
    res.classList.add("projects");
    projects.forEach(projectId => {
        const project = JSON.parse(localStorage.getItem(`maps/projects/${projectId}`));
        const elem = document.createElement("li");
        const name = document.createElement("p");
        const prev = document.createElement("img");
        const actions = document.createElement("div");
        elem.classList.add("project");
        name.classList.add("name");
        prev.classList.add("prev");
        actions.classList.add("actionsWrap");
        name.textContent = project.name;
        elem.setAttribute("project-color", project.color);
        console.log(project, projectId);
        project.id = projectId;
        addHoldEventListener(elem, {
            onClick(e) {
                const a = document.createElement("a");
                const link = `/tools/maps/view?m=${projectId}`;
                a.href = link;
                a.click();
                console.log("ABCD");
            },
            onRClick(e) { editProject(project); },
            onHold(e) {
                e.preventDefault();
                navigator.vibrate([50]);
                editProject(project);
            }
        }, 500);
        elem.appendChild(name);
        elem.appendChild(prev);
        //elem.appendChild(actions);
        res.appendChild(elem);
    });
    return res
}
function init() {
    const newBtn = document.createElement("button");
    const editMenu = document.createElement("div");
    const editName = document.createElement("input");
    const editColors = document.createElement("div");
    const editColInp = document.createElement("input");
    const editColHex = document.createElement("input");
    const editActions = document.createElement("div");
    const editActCanc = document.createElement("button");
    const editActSave = document.createElement("button");
    const editDelete = document.createElement("button");
    const editDeleteSpan = materialIcon("delete");
    const editDeleteP = document.createElement("p");
    const newProjectBtn = document.createElement("button");
    const npbIcon = materialIcon("add_circle");
    const npbName = document.createElement("p");
    newBtn.classList.add("newBtn");
    editMenu    .classList.add("menu");
    editName    .classList.add("name");
    editColors  .classList.add("colors");
    editColInp  .classList.add("inp");
    editColHex  .classList.add("hex");
    editActions .classList.add("actions");
    editActCanc .classList.add("cancel");
    editActSave .classList.add("save");
    editDelete  .classList.add("deleteBtn");
    editDeleteSpan.classList.add("span");
    editDeleteP .classList.add("p");
    newProjectBtn.classList.add("newProjectBtn");
    editName.type   = "text";
    editColInp.type = "color";
    editColHex.type = "text";
    editName.placeholder = "Name";
    editColHex.placeholder = "Hex";
    editActCanc.textContent = "Cancel";
    editActSave.textContent = "Save";
    npbName.textContent = "New Project";
    editDeleteP.textContent = "Delete Project";
    newBtn.addEventListener("click", e => createNewProject());
    editColInp.addEventListener("change", () => editColHex.value = editColInp.value.slice(1).toUpperCase());
    editColHex.addEventListener("input", () => editColInp.value = "#" + editColHex.value);
    editActCanc.addEventListener("click", () => edit.classList.remove("open"));
    editActSave.addEventListener("click", e => {
        const id = edit.getAttribute("project-id");
        const project = JSON.parse(localStorage.getItem(`maps/projects/${id}`));
        project.name = editName.value ?? "New Project";
        project.color = editColHex.value ? "#" + editColHex.value : generateRandomHex();
        localStorage.setItem(`maps/projects/${id}`, JSON.stringify(project));
        edit.classList.remove("open");
        updateProjects();
    }, true);
    newProjectBtn.addEventListener("click", e => {
        e.preventDefault();
        createNewProject();
    });
    editDelete.addEventListener("click", e => {
        if (!confirm("Are you sure you want to delete this project?")) return;
        //alert("DELETING");
        let projects = JSON.parse(localStorage.getItem("maps/projects"));
        const id = edit.getAttribute("project-id");
        if (!edit) return alert("Project couldnt be found");
        projects = projects.filter(entry => {
            return entry !== id;
        });
        localStorage.removeItem(`maps/projects/${id}`);
        localStorage.setItem("maps/projects", JSON.stringify(projects));
        edit.classList.remove("open");
        updateProjects();
    });
    wrapper.appendChild(loadProjects());
    editColors.appendChild(editColInp);
    editColors.appendChild(editColHex);
    editDelete.appendChild(editDeleteSpan);
    editDelete.appendChild(editDeleteP);
    editActions.appendChild(editActCanc);
    editActions.appendChild(editActSave);
    editMenu.appendChild(editName);
    editMenu.appendChild(editColors);
    editMenu.appendChild(editDelete);
    editMenu.appendChild(editActions);
    edit.appendChild(editMenu);
    newProjectBtn.appendChild(npbIcon);
    newProjectBtn.appendChild(npbName);
    nav.appendChild(newProjectBtn);
}
init();
document.addEventListener("keydown", e => {
    if (e.key.toLowerCase() === "q") {
        localStorage.setItem("maps/projects",
            JSON.stringify(
                Array(
                    Number(prompt("Set projects count"))
                ).fill("testId")
            ) ?? ""
        );
        wrapper.innerHTML = "";
        wrapper.appendChild(loadProjects());
    }
    if (e.key.toLowerCase() === "w") {
        const id = prompt("Project id:");
        const name = prompt("Project name:");
        const color = generateRandomHex();
        localStorage.setItem("maps/projects/" + id,
            JSON.stringify({
                name: name,
                color: color
            }) ?? {}
        );
        wrapper.innerHTML = "";
        wrapper.appendChild(loadProjects());
    }
    if (e.key.toLowerCase() === "e") {
        // console.log("RELOADING..");
        updateProjects();
    }
    if (e.key.toLowerCase() === "a") {
        edit.classList.toggle("open");
        edit.setAttribute("project-id", "testId");
        const data = JSON.parse(localStorage.getItem("maps/projects/testId"));
        console.log(data);
        editProject(data);
    }
});
// localStorage.setItem("maps/projects", JSON.stringify(["testId","testId","testId","testId","testId"]));
// localStorage.setItem("maps/projects/testId", JSON.stringify({"name":"TEST","color":"#2cae36"}));
// alertJson(localStorage);