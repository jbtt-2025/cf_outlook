import { execSync } from 'child_process';

console.log('📦 [1/3] 编译前端静态页面...');
execSync('npm run build', { stdio: 'inherit' });

console.log('⚡ [2/3] 编译边缘 Functions 网关至 dist/_worker.js...');
execSync('npx wrangler pages functions build functions --outfile=dist/_worker.js', { stdio: 'inherit' });

console.log('🗜️ [3/3] 打包生成全栈直接部署压缩包 dist.zip...');
if (process.platform === 'win32') {
  execSync('powershell -Command "Compress-Archive -Path dist\\* -DestinationPath dist.zip -Force"', { stdio: 'inherit' });
} else {
  execSync('cd dist && zip -r ../dist.zip .', { stdio: 'inherit' });
}

console.log('\n🎉 打包完成！生成文件: dist.zip');
console.log('👉 可直接在 Cloudflare Pages 控制台「直接上传」此 ZIP 文件完成零门槛部署！\n');
