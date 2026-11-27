<template>
  <template v-if="enabled && text">
    <template v-for="(seg, idx) in segments" :key="idx">
      <ruby v-if="seg.iast" class="bv-iast-ruby">
        {{ seg.text }}<rp> (</rp><rt class="bv-iast-rt">{{ seg.iast }}</rt><rp>)</rp>
      </ruby>
      <template v-else>{{ seg.text }}</template>
    </template>
  </template>
  <template v-else>{{ text }}</template>
</template>

<script setup lang="ts">
import { computed } from "vue";
import {
  type DevanagariLangMode,
  segmentDevanagariForRuby,
} from "../services/iastCore";

const props = defineProps<{
  text: string;
  lang: DevanagariLangMode;
  enabled: boolean;
}>();

const segments = computed(() =>
  props.enabled ? segmentDevanagariForRuby(props.text, props.lang) : [],
);
</script>

<style scoped>
ruby.bv-iast-ruby {
  ruby-position: under;
  -webkit-ruby-position: after;
  ruby-align: center;
}

rt.bv-iast-rt {
  font-family: "STIX Two Text", "Gentium Plus", "Iowan Old Style", Georgia, serif;
  font-size: 0.62em;
  font-weight: 400;
  font-style: normal;
  line-height: 1.15;
  color: var(--text-muted, #6b6257);
  letter-spacing: 0.01em;
  user-select: none;
}
</style>
