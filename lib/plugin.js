import {asanaTasksNextWeek, asanaTasksToday, asanaTasksUpdatedSince} from "./asana-tasks.js"
import {escapeMarkdown} from "./utils.js";
import {getLastUpdateTime, saveAsanaTasks} from "./amplenote-tasks.js";

// --------------------------------------------------------------------------------------
// API Reference: https://www.amplenote.com/help/developing_amplenote_plugins
// Tips on developing plugins: https://www.amplenote.com/help/guide_to_developing_amplenote_plugins
const plugin = {
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
        app.alert("Asana tasks synchronized!")
      }
    },
    "Tasks Today": {
      check: async function(app, noteUUID) {
        return true;
      },
      run: async function(app, noteUUID) {
        const tasks = await asanaTasksToday();
        app.insertNoteContent({ uuid: noteUUID }, "## Tasks Today:\r\n", {atEnd: true});
        tasks.forEach((task) => {
          const content = "- " + escapeMarkdown(task.name) + " - " + "[Asana][^1] \r\n [^1]: [Asana](" + task.permalink_url + ") \r\n " + task.gid;
          app.insertNoteContent({ uuid: noteUUID }, content, {atEnd: true});
        })
      }
    },
    "Tasks Next Week": {
      check: async function(app, noteUUID) {
        return true;
      },
      run: async function(app, noteUUID) {
        const tasks = await asanaTasksNextWeek();
        app.insertNoteContent({ uuid: noteUUID }, "## Tasks Next Week:\r\n", {atEnd: true});
        tasks.forEach((task) => {
          const content = "- " + escapeMarkdown(task.name) + " - " + "[Asana][^1] \r\n [^1]: [Asana](" + task.permalink_url + ") \r\n " + task.gid;
          app.insertNoteContent({ uuid: noteUUID }, content, {atEnd: true});
        })
      }
    }
  }
};
export default plugin;
