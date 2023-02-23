import express from 'express';
import { validationResult } from 'express-validator';
import { catchErrors } from '../lib/catch-errors.js';
import { listEvent, listEvents, listRegistered, register } from '../lib/db.js';
import {createUser,findByUsername} from '../lib/users.js';
import {
  registrationValidationMiddleware,
  sanitizationMiddleware,
  xssSanitizationMiddleware,
} from '../lib/validation.js';

export const indexRouter = express.Router();

async function indexRoute(req, res) {
  const events = await listEvents();

  res.render('index', {
    title: 'Viðburðasíðan',
    admin: false,
    events,
    user: req.user
  });
}

async function eventRoute(req, res, next) {
  const { slug } = req.params;
  const event = await listEvent(slug);

  if (!event) {
    return next();
  }

  const registered = await listRegistered(event.id);

  return res.render('event', {
    admin: false,
    title: `${event.name} — Viðburðasíðan`,
    event: event,
    registered: registered,
    errors: [],
    data: {},
  });
}

async function eventRegisteredRoute(req, res) {
  const events = await listEvents();

  res.render('registered', {
    title: 'Viðburðasíðan',
    events,
  });
}

async function validationCheck(req, res, next) {
  const { name, comment } = req.body;

  // TODO tvítekning frá því að ofan
  const { slug } = req.params;
  const event = await listEvent(slug);
  const registered = await listRegistered(event.id);

  const data = {
    name,
    comment,
  };

  const validation = validationResult(req);

  if (!validation.isEmpty()) {
    return res.render('event', {
      admin: false,
      title: `${event.name} — Viðburðasíðan`,
      data,
      event: event,
      registered,
      errors: validation.errors,
    });
  }

  return next();
}

async function registerRoute(req, res) {
  const { name, comment } = req.body;
  const { slug } = req.params;
  const event = await listEvent(slug);

  const registered = await register({
    name,
    comment,
    event: event.id,
  });

  if (registered) {
    return res.redirect(`/${event.slug}`);
  }

  return res.render('error');
}

indexRouter.get('/signup', (req, res) => {
  res.render('signup', { title: 'Nýskráning' });
});

indexRouter.post('/signup', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.render('signup', { error: 'Not all fields were filled in.' });
  }

  try {
    const existingUser = await findByUsername(username);

    if (existingUser) {
      return res.render('signup', { error: 'This username is already taken.' });
    }

    const user = await createUser(username, password);

    if (!user) {
      return res.render('signup', { error: 'An error occurred while creating your account.' });
    }

    return res.redirect('/');
  } catch (error) {
    console.error(error);
    return res.render('signup', { error: 'An error occurred while processing your request.' });
  }
});

indexRouter.get('/', catchErrors(indexRoute));
indexRouter.get('/:slug', catchErrors(eventRoute));
indexRouter.post(
  '/:slug',
  registrationValidationMiddleware('comment'),
  xssSanitizationMiddleware('comment'),
  catchErrors(validationCheck),
  sanitizationMiddleware('comment'),
  catchErrors(registerRoute)
);
indexRouter.get('/:slug/thanks', catchErrors(eventRegisteredRoute));