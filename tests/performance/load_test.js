import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
    stages: [
        { duration: '30s', target: 20 },
        { duration: '1m30s', target: 10 },
        { duration: '20s', target: 0 },
    ],
};

// Ensure you have a PDF file named 'test_load.pdf' in uploads before running or handle upload
export default function () {
    const res = http.get('http://localhost:5001/');
    check(res, { 'status was 200': (r) => r.status == 200 });
    sleep(1);
}
