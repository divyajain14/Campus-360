const express = require("express");
const Event = require("../models/event");
const Registration = require("../models/registration");
const { authMiddleware, adminMiddleware } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const events = await Event.find().sort({ date: 1 });
    res.json(events);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }
    res.json(event);
  } catch (error) {
    res.status(400).json({ message: "Invalid event ID" });
  }
});

router.post("/", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { title, description, date, venue, capacity } = req.body;

    if (!title || !description || !date || !venue || capacity === undefined) {
      return res.status(400).json({
        message: "Title, description, date, venue, and capacity are required"
      });
    }

    if (Number(capacity) < 1) {
      return res.status(400).json({ message: "Capacity must be at least 1" });
    }

    const event = await Event.create({
      title: title.trim(),
      description: description.trim(),
      date,
      venue: venue.trim(),
      capacity: Number(capacity),
      createdBy: req.user.id
    });

    res.status(201).json(event);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put("/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const allowedFields = ["title", "description", "date", "venue", "capacity"];
    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (updates.capacity !== undefined) {
      updates.capacity = Number(updates.capacity);
      if (!Number.isInteger(updates.capacity) || updates.capacity < 1) {
        return res.status(400).json({ message: "Capacity must be a positive whole number" });
      }

      const registrationCount = await Registration.countDocuments({
        eventId: req.params.id
      });
      if (updates.capacity < registrationCount) {
        return res.status(400).json({
          message: `Capacity cannot be lower than ${registrationCount} registered users`
        });
      }
    }

    const event = await Event.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    res.json(event);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete("/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    await Registration.deleteMany({ eventId: event._id });

    res.json({ message: "Event deleted successfully" });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
