import {escapeMarkdown} from "./utils.js";
import {completeAsanaTask} from "./asana-tasks.js";

const jsonNoteName = "AsanaPluginData";

async function getTaskRelations(app) {
    const jsonNote = await getOrCreateJsonNote(app);
    const jsonNoteContent = await jsonNote.content();
    const taskRelationJson = jsonNoteContent.split("\\\n\\")[1].replace("\\", "").split("# Hidden tasks")[0].split("# Completed tasks")[0].trimEnd();
    if (!taskRelationJson) return [];
    return JSON.parse(taskRelationJson);
}

export async function saveAsanaTasks(app, noteUUID, asanaTasks) {
    const jsonNote = await getOrCreateJsonNote(app);
    const taskRelations = await getTaskRelations(app);
    for (const task of asanaTasks) {
        const existing = taskRelations.filter(t => t.asanaGID == task.gid).pop();
        if (!existing && !task.completed) {
            let content = escapeMarkdown(task.name) + " - " + "[Asana][^1] \r\n [^1]: [Asana](" + task.permalink_url + ") \r\n";
            if (task.due_on) {
                content = insertOrUpdateDueDate(content, task.due_on);
            }
            if (task.notes)
                content = insertOrUpdateNotes(content, task.notes);
            try {
                let taskUUID = await app.insertTask({uuid: noteUUID}, {content: content});
                taskRelations.push({ampleNoteUUID: taskUUID, asanaGID: task.gid});
            } catch (error) {
                console.error(error);
                console.log(content);
            }
        } else if (existing) {
            if (task.completed) {
                await app.updateTask(existing.ampleNoteUUID, { completedAt: Math.floor(Date.now() / 1000) });
            }
            let ampleTask = await app.getTask(existing.ampleNoteUUID);
            if (ampleTask) {
                let updatedContent = ampleTask.content;
                if (task.due_on)
                    updatedContent = insertOrUpdateDueDate(updatedContent, task.due_on);
                if (task.notes)
                    updatedContent = insertOrUpdateNotes(updatedContent, task.notes);
                try {
                await app.updateTask(existing.ampleNoteUUID, {content: updatedContent});
                } catch (error) {
                    console.error(error);
                    console.log(updatedContent);
                }
            }
        }
    }
    let newTaskRelations = [];
    const lastUpdateTime = await getLastUpdateTime(app);
    for (const relation of taskRelations) {
        const task = await app.getTask(relation.ampleNoteUUID);
        if (!task) {
            continue;
        }
        if (task.completedAt > lastUpdateTime / 1000) {
            await completeAsanaTask(relation.asanaGID);
        }
        newTaskRelations.push(relation);
    }
    app.replaceNoteContent({ uuid: jsonNote.uuid }, Date.now() + "\r\n" + JSON.stringify(newTaskRelations));
}

async function getOrCreateJsonNote(app) {
    const jsonNoteHandle = await app.findNote({ name: jsonNoteName });
    let jsonNote;
    if (jsonNoteHandle === null) {
        const jsonNoteUUID = await app.createNote(jsonNoteName);
        jsonNote = await app.notes.find(jsonNoteUUID);
        jsonNote.insertContent(0 + "\r\n");
    } else {
        jsonNote = await app.notes.find(jsonNoteHandle);
    }
    return jsonNote;
}

export async function getLastUpdateTime(app) {
    const jsonNote = await getOrCreateJsonNote(app);
    const content = (await jsonNote.content()).split("\r\n");
    return parseInt(content[0], 10);
}

function insertOrUpdateDueDate(taskContent, dueOn) {
    let dueDate = new Date(Date.parse(dueOn));
    if (!taskContent.includes("\">Due")) {
        return taskContent.slice(0, taskContent.indexOf("[^1]") + 4) + " ==Due " + dueDate.getDate() + "." + (dueDate.getMonth() + 1) + "." + dueDate.getFullYear() + `<!-- {"cycleColor": "23"} -->==` + taskContent.slice(taskContent.indexOf("[^1]") + 4);
    } else {
        return taskContent.slice(0, taskContent.indexOf("\">Due") + 6) + dueDate.getDate() + "." + (dueDate.getMonth() + 1) + "." + dueDate.getFullYear() + taskContent.slice(taskContent.indexOf("<!-- {\"cycleColor\""));
    }
}

function insertOrUpdateNotes(taskContent, notes) {
    notes = notes.replaceAll("    ", "- ").replaceAll("\n", "\n    ");
    if (!taskContent.includes("    ", taskContent.indexOf("[^1]"))) {
        return taskContent + "    " + notes;
    } else {
        return taskContent.slice(0, taskContent.indexOf("    ") + 4) + notes;
    }
}

