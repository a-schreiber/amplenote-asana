(() => {
  // lib/utils.js
  function escapeMarkdown(text) {
    return text.replace("[", "\\\\[");
  }

  // lib/amplenote-tasks.js
  var jsonNoteName = "AsanaPluginData";
  async function getTaskRelations(app) {
    const jsonNote = await getOrCreateJsonNote(app);
    const jsonNoteContent = await jsonNote.content();
    const taskRelationJson = jsonNoteContent.split("\\\n\\")[1].replace("\\", "").split("# Hidden tasks")[0].split("# Completed tasks")[0].trimEnd();
    if (!taskRelationJson)
      return [];
    return JSON.parse(taskRelationJson);
  }
  async function saveAsanaTasks(app, noteUUID, asanaTasks) {
    const jsonNote = await getOrCreateJsonNote(app);
    const taskRelations = await getTaskRelations(app);
    for (const task of asanaTasks) {
      const existing = taskRelations.filter((t) => t.asanaGID == task.gid).pop();
      if (!existing && !task.completed) {
        let content = escapeMarkdown(task.name) + " - [Asana][^1] \r\n [^1]: [Asana](" + task.permalink_url + ") \r\n";
        if (task.due_on) {
          content = insertOrUpdateDueDate(content, task.due_on);
        }
        if (task.notes)
          content = insertOrUpdateNotes(content, task.notes);
        try {
          let taskUUID = await app.insertTask({ uuid: noteUUID }, { content });
          taskRelations.push({ ampleNoteUUID: taskUUID, asanaGID: task.gid });
        } catch (error) {
          console.error(error);
          console.log(content);
        }
      } else {
        if (task.completed) {
          await app.updateTask(existing.ampleNoteUUID, { completedAt: Math.floor(Date.now() / 1e3) });
        }
        let ampleTask = await app.getTask(existing.ampleNoteUUID);
        if (ampleTask) {
          let updatedContent = ampleTask.content;
          if (task.due_on)
            updatedContent = insertOrUpdateDueDate(updatedContent, task.due_on);
          if (task.notes)
            updatedContent = insertOrUpdateNotes(updatedContent, task.notes);
          try {
            await app.updateTask(existing.ampleNoteUUID, { content: updatedContent });
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
      if (task.completedAt > lastUpdateTime / 1e3) {
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
      jsonNote.insertContent("0\r\n");
    } else {
      jsonNote = await app.notes.find(jsonNoteHandle);
    }
    return jsonNote;
  }
  async function getLastUpdateTime(app) {
    const jsonNote = await getOrCreateJsonNote(app);
    const content = (await jsonNote.content()).split("\r\n");
    return parseInt(content[0], 10);
  }
  function insertOrUpdateDueDate(taskContent, dueOn) {
    let dueDate = new Date(Date.parse(dueOn));
    if (!taskContent.includes('">Due')) {
      return taskContent.slice(0, taskContent.indexOf("[^1]") + 4) + " ==Due " + dueDate.getDate() + "." + (dueDate.getMonth() + 1) + "." + dueDate.getFullYear() + `<!-- {"cycleColor": "23"} -->==` + taskContent.slice(taskContent.indexOf("[^1]") + 4);
    } else {
      return taskContent.slice(0, taskContent.indexOf('">Due') + 6) + dueDate.getDate() + "." + (dueDate.getMonth() + 1) + "." + dueDate.getFullYear() + taskContent.slice(taskContent.indexOf('<!-- {"cycleColor"'));
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

  // lib/asana-tasks.js
  var baseUrl = "https://app.asana.com/api/1.0/";
  var headers = {
    "Authorization": `Bearer 2/15894757384019/1208504279082773:d91b2b68169b6b4bd736ea616cced96f`,
    "Content-Type": "application/json"
  };
  async function asanaTasksUpdatedSince(lastUpdateTime, onlyActive = false) {
    const todayString = (/* @__PURE__ */ new Date()).toISOString();
    const lastUpdateString = new Date(lastUpdateTime).toISOString();
    let url = `tasks?assignee=15894757384019&workspace=15873283462965&modified_since=${lastUpdateString}&opt_fields=name,due_on,notes,permalink_url,projects,completed`;
    if (onlyActive) {
      url += `&completed_since=${todayString}`;
    }
    try {
      const response = await fetch(baseUrl + url, {
        headers
      });
      const tasks = await response.json();
      return tasks.data;
    } catch (error) {
      console.error("Error fetching Asana tasks:", error);
      throw error;
    }
  }
  async function completeAsanaTask(gid) {
    let url = `tasks/${gid}`;
    try {
      const response = await fetch(baseUrl + url, {
        method: "PUT",
        headers,
        body: JSON.stringify({ data: { completed: true } })
      });
      await response.json();
    } catch (error) {
      console.error("Error updating Asana task:", error);
      throw error;
    }
  }
  async function asanaTasksToday() {
    const todayString = (/* @__PURE__ */ new Date()).toISOString();
    const url = `tasks?assignee=15894757384019&workspace=15873283462965&completed_since=${todayString}&opt_fields=name,due_on,notes,permalink_url,projects`;
    try {
      const response = await fetch(baseUrl + url, {
        headers
      });
      const tasks = await response.json();
      const today = tasks.data.filter(function(task) {
        return task.due_on === todayString.slice(0, 10);
      });
      return today;
    } catch (error) {
      console.error("Error fetching Asana tasks:", error);
      throw error;
    }
  }
  async function asanaTasksNextWeek() {
    const todayString = (/* @__PURE__ */ new Date()).toISOString();
    const url = `tasks?assignee=15894757384019&workspace=15873283462965&completed_since=${todayString}&opt_fields=name,due_on,notes,permalink_url,projects`;
    try {
      const response = await fetch(baseUrl + url, {
        headers
      });
      const tasks = await response.json();
      const nextMonday = /* @__PURE__ */ new Date();
      nextMonday.setDate(nextMonday.getDate() + (1 + 7 - nextMonday.getDay()) % 7);
      nextMonday.setHours(0);
      nextMonday.setMinutes(0);
      nextMonday.setSeconds(0);
      nextMonday.setMilliseconds(0);
      const endDate = nextMonday.valueOf() + 7 * 24 * 60 * 60 * 1e3;
      const nextWeek = tasks.data.filter(function(task) {
        const taskDate = Date.parse(task.due_on);
        const startDate = nextMonday.valueOf();
        return taskDate <= endDate && taskDate >= startDate;
      });
      return nextWeek;
    } catch (error) {
      console.error("Error fetching Asana tasks:", error);
      throw error;
    }
  }
  asanaTasksNextWeek().then();

  // lib/plugin.js
  var plugin = {
    // --------------------------------------------------------------------------
    // https://www.amplenote.com/help/developing_amplenote_plugins#noteOption
    noteOption: {
      "Sync Tasks": {
        check: async function(app, noteUUID) {
          return true;
        },
        run: async function(app, noteUUID) {
          const lastUpdateTime = await getLastUpdateTime(app);
          let tasks;
          if (lastUpdateTime === 0)
            tasks = await asanaTasksUpdatedSince(lastUpdateTime, true);
          else
            tasks = await asanaTasksUpdatedSince(lastUpdateTime, false);
          await saveAsanaTasks(app, noteUUID, tasks);
          app.alert("Asana tasks synchronized!");
        }
      },
      "Tasks Today": {
        check: async function(app, noteUUID) {
          return true;
        },
        run: async function(app, noteUUID) {
          const tasks = await asanaTasksToday();
          app.insertNoteContent({ uuid: noteUUID }, "## Tasks Today:\r\n", { atEnd: true });
          tasks.forEach((task) => {
            const content = "- " + escapeMarkdown(task.name) + " - [Asana][^1] \r\n [^1]: [Asana](" + task.permalink_url + ") \r\n " + task.gid;
            app.insertNoteContent({ uuid: noteUUID }, content, { atEnd: true });
          });
        }
      },
      "Tasks Next Week": {
        check: async function(app, noteUUID) {
          return true;
        },
        run: async function(app, noteUUID) {
          const tasks = await asanaTasksNextWeek();
          app.insertNoteContent({ uuid: noteUUID }, "## Tasks Next Week:\r\n", { atEnd: true });
          tasks.forEach((task) => {
            const content = "- " + escapeMarkdown(task.name) + " - [Asana][^1] \r\n [^1]: [Asana](" + task.permalink_url + ") \r\n " + task.gid;
            app.insertNoteContent({ uuid: noteUUID }, content, { atEnd: true });
          });
        }
      }
    }
  };
  var plugin_default = plugin;
})();
