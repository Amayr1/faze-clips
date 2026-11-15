import test from 'node:test';
import assert from 'node:assert/strict';
import {creatorAffiliation} from '../lib/creator-affiliation.mjs';

test('active roster and alumni receive distinct badges across source channels', () => {
  assert.equal(creatorAffiliation({provider:'twitch', channel:'ZooMaa'}).status, 'member');
  assert.equal(creatorAffiliation({provider:'twitch', channel:'StableRonaldo'}).label, 'FaZe alumni');
  assert.equal(creatorAffiliation({provider:'kick', channel:'fazerain', url:'https://kick.com/fazerain/clips/clip_123456789012'}).label, 'FaZe legacy');
  assert.equal(creatorAffiliation({provider:'kick', channel:'yourrage', url:'https://kick.com/yourrage/clips/clip_123456789012'}).label, 'FaZe alumni');
});

test('names, titles and uploaded attribution cannot promote an account to the roster', () => {
  for (const clip of [
    {provider:'twitch', channel:'ishowspeed', channelName:'FaZe broky', title:'FaZe member'},
    {provider:'twitch', channel:'not_zoomaa'},
    {provider:'upload', channel:'zoomaa', channelName:'FaZe ZooMaa', streamUrl:'https://twitch.tv/zoomaa'},
    {provider:'youtube', channel:'zoomaa'},
    {provider:'twitch', channel:'ninja'},
    {},
  ]) assert.equal(creatorAffiliation(clip).status, 'unconfirmed');
});

test('Kick attribution must agree with the source clip channel', () => {
  for (const url of ['https://kick.com/xqc/clips/clip_123456789012', 'https://kick.com.evil.test/fazerain/clips/clip_123456789012', 'javascript:alert(1)', 'https://kick.com/fazerain']) {
    assert.equal(creatorAffiliation({provider:'kick',channel:'fazerain',url}).status, 'unconfirmed');
  }
});
