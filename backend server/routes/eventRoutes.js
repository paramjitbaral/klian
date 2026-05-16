const express = require('express');
const router = express.Router();
const { 
  createEvent,
  getEvents,
  getEventById,
  updateEvent,
  deleteEvent,
  attendEvent,
  unattendEvent,
  toggleEventReminder
} = require('../controllers/eventController');
const { protect, facultyOnly } = require('../middleware/auth');

// All routes are protected
router.route('/')
  .post(protect, facultyOnly, createEvent)
  .get(protect, getEvents);

router.route('/:id')
  .get(protect, getEventById)
  .put(protect, facultyOnly, updateEvent)
  .delete(protect, facultyOnly, deleteEvent);

router.put('/reminder/:id', protect, toggleEventReminder);
router.put('/attend/:id', protect, attendEvent);
router.put('/unattend/:id', protect, unattendEvent);

module.exports = router;