// import necessary module
import http from 'k6/http';
import { check } from 'k6';

export default function () {
  // define URL and payload
  const url = 'https://app.involve.asia/v2/login';
  const payload = JSON.stringify({
    username: 'joseph.thanaraj771@gmail.com',
    password: 'Jojo@IA55$',
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  // send a post request and save response as a variable
  const res = http.post(url, payload, params);

  // Log the response is 200
    check(res, { 'status is 200': (r) => r.status === 200 });
}