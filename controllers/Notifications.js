const { Notification } = require("../models/Notification");
const _ = require("lodash");
const { User } = require("../models/User");

exports.fetchAll = async (req, res, next) => {
  const user = req.user;
  //paginate
  // in case of non-paginate
  req.allowPagination = false;
  let notifications = await Notification.find({
    targetUsers: { $in: [user.id] },
  })
    .sort("-createdAt")
    .populate("subject");

  const collection = req.allowPagination ? notifications.docs : notifications;
  console.log(notifications.docs);
  console.log(notifications);
  for (let i = 0; i < collection.length; i++) {
    let notification = _.cloneDeep(collection[i]);

    if (notification.seen) continue;
    notification.seen = true;
    await notification.save();
  }

  return res.status(200).json(notifications);
};

exports.numberOfUnSeen = async (req, res, next) => {
  const user = req.user;

  const notificationsCount = await Notification.countDocuments({
    targetUsers: user.id,
    seen: false,
  });

  const response = { count: notificationsCount };
  return res.status(200).json(response);
};

exports.subscribe = async (req, res, next) => {
  const user = req.user;

  const oldToken = req.body.oldToken;
  if (oldToken) {
    const index = _.findKey(
      user.pushTokens,
      _.matchesProperty("deviceToken", oldToken)
    );
    if (index !== undefined) {
      user.pushTokens.splice(index, 1);
    }
  }

  const token = req.body.token;
  try {
    if (token) {
      const index = _.findKey(
        user.pushTokens,
        _.matchesProperty("deviceToken", token)
      );
      if (index === undefined) {
        user.pushTokens.push({
          deviceType: req.body.deviceType,
          deviceToken: token,
        });
      }
    }

    await user.save();
    return res.status(200).json(user);
  } catch (error) {
    next(error);
  }
};

exports.unsubscribe = async (req, res, next) => {
  const user = req.user;

  const token = req.body.token;
  if (token) {
    const index = _.findKey(
      user.pushTokens,
      _.matchesProperty("deviceToken", token)
    );
    if (index !== undefined) {
      user.pushTokens.splice(index, 1);
      await user.save();
    }
  }

  return res.status(200).json(user);
};

exports.sendToAll = async (req, res, next) => {
  await sendNotification({
    title: req.body.title,
    body: req.body.body,
    query: {}, // filter with any properties , according to front end requirements
    user: req.user._id, // sender of notification (usually admin only who can access this end point)
    subjectType: "User", // write suitable subjectType
    subject: req.user._id, // put Id of that subjectType
  });
  return res.status(204).json();
};

const sendNotification = async (data) => {
  try {
    // Send Notification in-app
    const clients = await User.find(data.query);
    const targetUsers = clients.map((user) => user.id);
    const notification = await new Notification({
      title: data.title,
      body: data.body,
      user: data.user,
      targetUsers: targetUsers,
      subjectType: data.subjectType,
      subject: data.subject,
    }).save();

    // push notifications
    const receivers = clients;
    for (let i = 0; i < receivers.length; i++) {
      await receivers[i].sendNotification(
        notification.toFirebaseNotification()
      );
    }
  } catch (error) {
    console.log(error);
  }
};