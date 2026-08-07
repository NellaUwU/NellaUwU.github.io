import { api, API } from "/script/shared.js";

const urlInput = document.querySelector("#youtubeUrl");
urlInput.value = "https://youtu.be/gq0C6-Qu1eQ?si=QuD5Jt1v1-kZFytN";
const loadBtn = document.querySelector("#loadInfo");
const downloadBtn = document.createElement("button");
downloadBtn.textContent = "Download video";
const body = document.querySelector("body");

body.appendChild(downloadBtn);
const thumbnail = document.querySelector("#thumbnail");
const title = document.querySelector("#title");
const quality = document.querySelector("#quality");
const qualityElem = quality;
let currentVideo;
let currentFileName = "";
class YoutubeVideo {
    constructor(data) {
        Object.assign(this, data);
    }
    getQuality(id) {
        return this.qualities.find(q => q.id === id);
    }
    async download(url, quality) {
        const mediaType = qualityElem.options[ qualityElem.selectedIndex ].getAttribute("mediaType");
        const mediaExt = qualityElem.options[ qualityElem.selectedIndex ].getAttribute("mediaExt");
        console.log({ url, quality, type: mediaType });
        console.log("Selected quality:", quality);
        const response = await fetch(`${API}/download`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                url,
                quality,
                type: mediaType
            })
        });
        const responseData = await response.json();
        if (!response.ok) {
            throw new Error(
                responseData.error ||
                "Unable to start download."
            );
        }
        const { id } = responseData;
        console.log("Download job:", id);
        const events = new EventSource(
            `${API}/progress/${id}`
        );
        events.onmessage = async function (event) {
            const data = JSON.parse(event.data);
            //console.log(data.status, `${(data.done * 100).toFixed(1)}%`);
            // console.log("AHAHAHAHAHHAHAHAHAHAHAHAHAHAA");
            // console.log(data);
            if (data.status === "finished") {
                console.log("\\/\\/\\/\\/\\/\\/\\/")
                const res = await fetch(`${API}/download/${id}?extension=${mediaExt}`)
                .then((response) => {
                    if (!response.ok) throw new Error("File retrieval failed!");
                    const blob = response.blob();
                    console.log("Retrieved file!");
                    console.log(response, blob);
                    const nameInput = document.querySelector("#nameInput");
                    currentFileName = nameInput.value;
                    nameInput.value = currentFileName.match(/.+\.[\w]+$/gmi) ? currentFileName : nameInput.value + "." + mediaExt;
                    return blob;
                })
                .then((blob) => {
                    const btn = document.createElement("button");
                    btn.textContent = "CLICK ME!";
                    btn.addEventListener("click", (e) => {
                        const a = document.createElement("a");
                        a.href = URL.createObjectURL(blob);
                        a.download = document.querySelector("#nameInput").value;
                        a.click();
                    });
                    document.querySelector("body").appendChild(btn);
                })
                .catch((error) => {
                    console.log("failed fetch: " + error);
                })
                .finally((e) => {});
                events.close();
                /*
                * The final file is returned by a normal GET request.
                * Navigating to it avoids loading the entire video into a Blob
                * in browser memory.
                */
               //window.location.href = `${API}${data.downloadUrl}`;
            }
            if (data.status === "failed") {
                events.close();
                console.error(data.error);
                alert(data.error || "Download failed.");
            }
        };
        events.onerror = event => {
            console.error("SSE error:", event);
            /*
            * EventSource automatically reconnects, so do not close it here
            * unless the job has explicitly finished or failed.
            */
        };
    }
}
loadBtn.addEventListener("click", async () => {
    try {
        currentVideo = currentVideo = new YoutubeVideo(await api("/info", { url: urlInput.value }));
        console.log(currentVideo);
        thumbnail.src = currentVideo.thumbnail;
        title.textContent = currentVideo.title;
        document.querySelector("#nameInput").value = currentVideo.title;
        quality.replaceChildren();
        for (const q of currentVideo.qualities) {
            const option = document.createElement("option");
            option.value = q.id;
            option.textContent = q.label;
            option.setAttribute("mediaType", q.type);
            option.setAttribute("mediaExt", q.extension != "webm" ? q.extension : "mp4");
            quality.appendChild(option);
        }
    } catch(err) {
        alert(err.message);
    }
});
downloadBtn.addEventListener("click", (e) => { //testDownload();
    abcd(e);
    // console.log(urlInput, quality, urlInput.value, quality.value);
    // currentVideo.download(urlInput.value, quality.value);
});
async function abcd (e) {
    if (!currentVideo) {
        alert("Load the video information first.");
        return;
    }
    try {
        await currentVideo.download(urlInput.value, quality.value);
    } catch (error) {
        console.error(error);
        alert(error.message);
    }
}
async function testDownload() {
    const mediaType = quality.options[ quality.selectedIndex ].getAttribute("mediaType");
    console.log({ url: urlInput.value, quality: quality.value, type: mediaType });
    return;
    const start = await api("/download/start/", { url: urlInput.value, quality: quality.value, type: mediaType });
    console.log("JOB:", start.id);
    const events = new EventSource( API + "/download/status/" + start.id );
    events.onopen = () => {
        console.log("SSE connected");
    };
    events.onmessage = e => {
        const data = JSON.parse(e.data);
        console.log(data.status, Math.round(data.done * 100 + "%"));
    };
    events.onerror = () => {
        console.error("SSE error:", err);
        events.close();
    };
}
