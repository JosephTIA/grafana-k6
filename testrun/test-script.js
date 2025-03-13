import http from 'k6/http';
import { sleep, check } from 'k6';
//const hostname = 'https://${__ENV.DOMAIN}';   --need to fix this

export let options = {
  stages: [
    { duration: '1m', target: 10},
    { duration: '1m', target: 50},
    { duration: '3m', target: 0},
  ],
  thresholds: {
    http_req_failed: [{
      threshold: 'rate<=0.05',
      abortOnFail: true,
    }],
    http_req_duration: ['p(95)<=100'],
    checks: ['rate>=0.99'],
  },
};

export default function() {
  //Uncomment the below for the base test
  let url = 'https://httpbin.test.k6.io/post';
  let response = http.post(url, 'Hello world!');

  check(response, {
    'App says hello': (r) => r.body.includes('Hello world!')
  });
  //Uncomment the below for the env domain test along with the above hostname
  //let response = http.get(hostname + '/my_messages/php');

  sleep(2);
  console.log(response.json().data);
}
