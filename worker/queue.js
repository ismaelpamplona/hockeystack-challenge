const { queue } = require('async');
const _ = require('lodash');
const { goal } = require('../utils');

const createQueue = (domain, actions) =>
  queue(async (action, callback) => {
    actions.push(action);

    if (actions.length > 2000) {
      console.log(`[Queue] Inserting ${actions.length} actions into database...`);
      const copyOfActions = _.cloneDeep(actions);
      actions.splice(0, actions.length);
      goal(copyOfActions);
    }

    callback();
  }, 100000000);

const drainQueue = async (domain, actions, q) => {
  if (q.length() > 0) await q.drain();
  if (actions.length > 0) goal(actions);
  console.log(`[Queue] Final flush complete – ${actions.length} actions inserted.`);
  return true;
};

module.exports = { createQueue, drainQueue };
