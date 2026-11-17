import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateCaptionPayload, validateProjectPayload } from './src/lib/validation';

const validProject = {
  id: 'proj_123',
  ownerId: 'user_A',
  title: 'Morning Coffee Reel',
  aspectRatio: 'r916',
  duration: 30,
  trimStart: 0,
  trimEnd: 30,
  language: 'en-US',
  style: 'st-highlight',
  position: 'pos-bottom',
  accentColor: '#ffd60a',
  fontSize: 22,
  audioCleanEnabled: true,
  captionsCount: 4,
};

const validCaption = {
  id: 'cap_1',
  projectId: 'proj_123',
  ownerId: 'user_A',
  start: 0.5,
  end: 2.5,
  text: 'Fresh espresso pull',
  orderIndex: 0,
};

test('firestore.rules enforces global deny-all, verified email, and strict key checks', () => {
  const rules = fs.readFileSync('firestore.rules', 'utf8');
  assert.match(rules, /match \/\{document=\*\*\} \{\s*allow read, write: if false;/);
  assert.match(rules, /request\.auth\.token\.email_verified == true/);
  assert.match(rules, /affectedKeys\(\)\.hasOnly\(/);
  assert.match(rules, /resource\.data\.ownerId == request\.auth\.uid/);
});

test('Dirty Dozen schema validation rejects shadow fields, ID poisoning, and invalid values', () => {
  assert.equal(validateProjectPayload(validProject).valid, true);
  assert.equal(validateCaptionPayload(validCaption).valid, true);

  // Shadow field injection
  assert.equal(validateProjectPayload({ ...validProject, isAdmin: true }).valid, false);
  // ID poisoning
  assert.equal(validateProjectPayload({ ...validProject, id: '../../evil' }).valid, false);
  assert.equal(validateProjectPayload({ ...validProject, id: 'a'.repeat(130) }).valid, false);
  // Invalid style enum / type poisoning
  assert.equal(validateProjectPayload({ ...validProject, style: 'hacked-style' }).valid, false);
  assert.equal(validateProjectPayload({ ...validProject, style: 'st-minimal', fontFamily: 'editorial' }).valid, true);
  assert.equal(validateProjectPayload({ ...validProject, style: 'st-font-switch', fontFamily: 'invalid-font' }).valid, false);
  assert.equal(validateProjectPayload({ ...validProject, title: 'x'.repeat(125) }).valid, false);
  assert.equal(validateProjectPayload({ ...validProject, accentColor: 'red' }).valid, false);
  // Invalid trim window
  assert.equal(validateProjectPayload({ ...validProject, trimStart: 10, trimEnd: 5 }).valid, false);
  // Caption invalid bounds and shadow fields
  assert.equal(validateCaptionPayload({ ...validCaption, start: 5, end: 2 }).valid, false);
  assert.equal(validateCaptionPayload({ ...validCaption, text: 'z'.repeat(501) }).valid, false);
  assert.equal(validateCaptionPayload({ ...validCaption, role: 'admin' }).valid, false);
  // Bounded Spotlight keyWords and two-axis StyleConfig validation
  assert.equal(
    validateProjectPayload({
      ...validProject,
      wordSpacing: 0.42,
      revealMode: 'spotlight',
      effect: 'scaleUp',
      wordsPerPage: '3',
      pageLayout: 'stack',
      spotlightAuto: true,
      blendMode: 'difference',
    }).valid,
    true
  );
  assert.equal(validateProjectPayload({ ...validProject, wordSpacing: 4.5 }).valid, false);
  assert.equal(validateProjectPayload({ ...validProject, revealMode: 'bogus' }).valid, false);
  assert.equal(validateCaptionPayload({ ...validCaption, keyWords: ['espresso', '$5'] }).valid, true);
  assert.equal(validateCaptionPayload({ ...validCaption, keyWords: Array(45).fill('a') }).valid, false);
});

