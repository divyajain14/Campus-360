const express = require("express");
const Event = require("../models/event");
const Registration = require("../models/registration");
const { authMiddleware } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/events/:eventId", authMiddleware, async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    const registrationCount = await Registration.countDocuments({
      eventId: event._id
    });

    if (registrationCount >= event.capacity) {
      return res.status(400).json({ message: "Event is full" });
    }

    const registration = await Registration.create({
      userId: req.user.id,
      eventId: event._id
    });

    res.status(201).json({
      message: "Event registration successful",
      registration
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Already registered for this event" });
    }
    res.status(400).json({ message: error.message });
  }
});

router.delete("/events/:eventId", authMiddleware, async (req, res) => {
  try {
    const registration = await Registration.findOneAndDelete({
      userId: req.user.id,
      eventId: req.params.eventId
    });

    if (!registration) {
      return res.status(404).json({ message: "Registration not found" });
    }

    res.json({ message: "Event registration cancelled" });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.get("/me", authMiddleware, async (req, res) => {
  try {
    const registrations = await Registration.find({ userId: req.user.id })
      .populate("eventId");

    res.json(registrations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
