import { execSync } from 'child_process';

try {
    console.log('--- Git Show 768cec8 ---');
    const show = execSync('git show 768cec8 --name-status', { encoding: 'utf8' });
    console.log(show);

    console.log('--- Git Show 12ca196 ---');
    const show2 = execSync('git show 12ca196 --name-status', { encoding: 'utf8' });
    console.log(show2);
} catch (err) {
    console.error(err);
}
