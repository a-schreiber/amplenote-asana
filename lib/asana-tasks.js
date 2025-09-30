// --------------------------------------------------------------------------
import {getLastUpdateTime} from "./amplenote-tasks.js";

const baseUrl = 'https://app.asana.com/api/1.0/';
const headers = {
    'Authorization': `Bearer 2/15894757384019/1208504279082773:d91b2b68169b6b4bd736ea616cced96f`,
    'Content-Type': 'application/json'
};

export async function asanaTasksUpdatedSince(lastUpdateTime, onlyActive = false) {
    const todayString = new Date().toISOString();
    const lastUpdateString = new Date(lastUpdateTime).toISOString();
    let url = `tasks?assignee=15894757384019&workspace=15873283462965&modified_since=${lastUpdateString}&opt_fields=name,due_on,notes,permalink_url,projects,completed`;
    if (onlyActive) {
        url += `&completed_since=${todayString}`
    }
    try {
        const response = await fetch(baseUrl + url, {
            headers : headers
        });
        const tasks = await response.json();
        return tasks.data;
    } catch (error) {
        console.error('Error fetching Asana tasks:', error);
        throw error;
    }
}

export async function completeAsanaTask(gid) {
    let url = `tasks/${gid}`;
    try {
        const response = await fetch(baseUrl + url, {
            method: 'PUT',
            headers : headers,
            body: JSON.stringify({ data: {completed: true }})
        });
        await response.json();
    } catch (error) {
        console.error('Error updating Asana task:', error);
        throw error;
    }
}

export async function asanaTasksToday() {
    const todayString = new Date().toISOString();
    const url = `tasks?assignee=15894757384019&workspace=15873283462965&completed_since=${todayString}&opt_fields=name,due_on,notes,permalink_url,projects`;

    try {
        const response = await fetch(baseUrl + url, {
            headers : headers
        });
        const tasks = await response.json();
        const today = tasks.data.filter(function (task) {
            return task.due_on === todayString.slice(0, 10)
        });
        return today;
    } catch (error) {
        console.error('Error fetching Asana tasks:', error);
        throw error;
    }
}

export async function asanaTasksNextWeek() {
    const todayString = new Date().toISOString();
    const url = `tasks?assignee=15894757384019&workspace=15873283462965&completed_since=${todayString}&opt_fields=name,due_on,notes,permalink_url,projects`;

    try {
        const response = await fetch(baseUrl + url, {
            headers : headers
        });
        const tasks = await response.json();
        const nextMonday = new Date();
        nextMonday.setDate(nextMonday.getDate() + (1 + 7 - nextMonday.getDay()) % 7);
        nextMonday.setHours(0);
        nextMonday.setMinutes(0);
        nextMonday.setSeconds(0);
        nextMonday.setMilliseconds(0);
        const endDate = nextMonday.valueOf() + (7*24*60*60*1000);
        const nextWeek = tasks.data.filter(function (task) {
            const taskDate = Date.parse(task.due_on);
            const startDate = nextMonday.valueOf();
            return taskDate <= endDate && taskDate >= startDate;
        });
        return nextWeek;
    } catch (error) {
        console.error('Error fetching Asana tasks:', error);
        throw error;
    }
}

asanaTasksNextWeek().then();
