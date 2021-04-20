const { Place } = require("../models/Place");
const { Rate } = require("../models/Rate");

exports.getAll = async (req, res, next) => {
  let rates = await Rate.paginate(
    { place: req.params.placeId },
    {
      select: "rating user place",
      sort: "-createdAt",
      populate: [
        { path: "user", select: "name" },
        { path: "place", select: "name rating" },
      ],
    }
  );
  res.status(200).send(rates);
};

exports.newRate = async (req, res, next) => {
  let place = await Place.findById(req.params.placeId);
  if (!place) return res.status(404).send("Place not found");

  let rate = await Rate.findOne({
    user: req.user._id,
    place: place._id,
  });
  if (rate) {
    await rate.set(req.body).save();
  } else {
    req.body.user = req.user._id;
    req.body.place = place._id;
    rate = new Rate(req.body);
    await rate.save();
  }

  let countRate = [];
  let numberOfRates = 0;
  let rating, count;
  for (let i = 1; i <= 5; i++) {
    rating = await Rate.countDocuments({
      place: place._id,
      rating: i,
    });
    countRate.push(rating);

    count = i * countRate[i - 1];
    numberOfRates += count;
  }

  let countAll = await Rate.countDocuments({
    place: place._id,
  });

  let newRating = numberOfRates / countAll;

  place.rating = newRating;
  await place.save();
  await Rate.populate(rate, [
    { path: "user", select: "name" },
    { path: "place", select: "name rating" },
  ]);
  res.status(200).send(rate);
};