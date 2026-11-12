import { createApp } from 'vue';
import App from './App.vue';
import './assets/style.css';
import { db } from './db';

// 暴露用于测试或快速重置的本地 DB 实例
if (typeof window !== 'undefined') {
  (window as any).__db = db;
  (window as any).__resetDB = async () => {
    await db.accounts.clear();
    await db.emails.clear();
  };
}

const app = createApp(App);
app.mount('#app');
