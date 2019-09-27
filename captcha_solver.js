// ==UserScript==
// @name         Freebitco.in Solver
// @namespace    http://tampermonkey.net/
// @version      0.3
// @description  try to take over the world!
// @author       Larry Suniaga
// @include      *://*.*
// @grant        GM_xmlhttpRequest
// @require      https://code.jquery.com/jquery-3.4.1.min.js
// @connect      2captcha.com
// @connect      *
// @noframes
// @updateURL    https://github.com/larrysun2/2captcha_api/raw/master/captcha_solver.js
// @downloadURL  https://github.com/larrysun2/2captcha_api/raw/master/captcha_solver.js
// ==/UserScript==

(function() {
	/* API KEY */
	var apiKey = "";
	var serverDomain = "https://2captcha.com/";
	var urlIn = serverDomain + "in.php";
	var urlRes = serverDomain + "res.php"
	const N_TRIES = 15;
	const SEC_INTERVAL = 10; // segundos/seconds
	const RELOAD_TIME = 15; //segundos/seconds

	var proccessing = false;
	var task = null;
	var n_captchas = 0;

	var ALLOWED_DOMAINS = [
		"freebitco.in"
	];

	function monitorize_task(id, client){
		return new Promise(function(accept, reject){
			var tries_left = N_TRIES;
			var finished = false;
			var timer = setTimeout(function(tries_left){
				var callee = arguments.callee;
				if(tries_left > 0){
					client.post_message("Intento Numero: " + ((N_TRIES - tries_left) + 1));
					console.log("Intento Numero: ", (N_TRIES - tries_left) + 1);
					var data = {
						key: apiKey,
						action: "get",
						id: id,
						json: "1"
					};
					client.post_message("Solicitando HASH para el id: " + id);
					console.log("Solicitando HASH para el id:", id);
					GM_xmlhttpRequest({
						url: urlRes + "?" + new URLSearchParams(data).toString(),
						method: "GET",
						responseType: "json",
						onload: function(xhr){
							var response = xhr.response;
							if(response.status){
								var hash = response.request;
								client.post_message("Se ha obtenido el HASH exitosamente: " + hash);
								console.log("Se ha obtenido el HASH exitosamente:", hash);
								accept(response.request);
								finished = true;
							}else{
								if(response.request != "CAPCHA_NOT_READY"){
									var error = respon.request;
									reject([client, error]);
								}else{
									client.post_message("El HASH aun no esta disponible...");
									console.log("El HASH aun no esta disponible...");
								}
							}
							if(!finished) timer = setTimeout(callee, SEC_INTERVAL*1000, tries_left-1);
						},
						error: function(xhr){
							if(!finished) timer = setTimeout(callee, SEC_INTERVAL*1000, tries_left-1);
						}
					});
				}else{
					reject([client, "Tiempo agotado..."]);
				}
			}, SEC_INTERVAL*1000, tries_left);
		})
	}

	function solve_recaptcha(sitekey, client){
		return new Promise((accept, reject)=>{
			proccessing = true;
			var data = {
				"key": apiKey,
				"method": "userrecaptcha",
				"googlekey": sitekey,
				"pageurl": location.href,
				"json": "1"
			};
			client.messages = $("<div>").css({
				"color": "white",
				"background": "gray",
				padding: "4px 0"
			});
			client.post_message = function(text){
				client.messages.html(text);
			};
			$(client.$$).append(client.message);
			client.post_message("Creando tarea...");
			console.log("Creando tarea:", data);
			GM_xmlhttpRequest({
				method: "GET",
				responseType: "json",
				url: urlIn + "?" + new URLSearchParams(data).toString(),
				onload: function(xhr){
					var response = xhr.response;
					if(response.status){
						var task_id = response.request;
						client.post_message("Se ha obtenido el id del pedido del HASH: " + task_id);
						console.log("Se ha obtenido el id del pedido del HASH:", task_id);
						monitorize_task(task_id, client).then(function(hash){
							accept(hash);
						}).catch(error=>reject(error));
					}else{
						var error = response.request;
						reject([client, error]);
					}
				},
				error: function(xhr){
					reject([client, xhr]);
				}
			})
		});
	}

	function get_all_rcs_elements(){
		var elements = get_rcs_clients().map(x=>{
			return {
				element: x.$$,
				properties: x
			}
		});
	}
    var find_element = x=>Object.entries(x).filter(([n, v], y) => v instanceof Element)[0][1];
	function get_rcs(){
		var rcs;
		try{
            rcs = ___grecaptcha_cfg && ___grecaptcha_cfg.clients?$(Object.assign([], ___grecaptcha_cfg.clients).filter((x)=>x.id<=___grecaptcha_cfg.count).map(x=>{
                return find_element(x);
            })):$();
			rcs = rcs.not("[solved]");
		}catch(e){rcs = $()}
		return rcs;
	}

	function get_client_rcs_properties(client){
		for(let i of Object.entries(client)){
			var values = Object.values(i[1]);
			if(values.length == 1 && values[0]["sitekey"] && values[0]["type"] !== undefined){
				return values[0];
			}
		}
		return {};
	}

	function get_rcs_clients(){
		return Object.assign([], ___grecaptcha_cfg.clients).filter((x)=>x.id<=___grecaptcha_cfg.count);
	}

	function set_rcs_properties(){
		var clients = get_rcs_clients();
		for(var client of clients){
			var properties = get_client_rcs_properties(client);
			client.config = properties;
		}
	}

	function execute_callbacks(){
		set_rcs_properties();
		get_rcs_clients().forEach(function(client) {
			if(client.config.callback != undefined){
				var hash = $(client.$$).attr("solved");
				client.config.callback(hash);
			}
		});
	}

	function verify_captcha(call){
		return new Promise((accept, reject) =>{
			var original_rcs = get_rcs();
			original_rcs.length == 0 && accept(false);
			original_rcs.each((i, x) =>{
				var client = get_rcs_clients()[i];
				call(true);
				console.log("Se ha conseguido un recaptcha...");
				solve_recaptcha($(x).data("sitekey") || $(x).attr("sitekey"), client).then(function(hash){
					$("[name=g-recaptcha-response]", x).val(hash);
					$(x).attr("solved", hash);
					client.post_message("Se ha resuelto el ReCaptcha con el HASH: " + hash);
					console.log("Se ha resuelto el ReCaptcha con el HASH:", hash);
					var rcs = get_rcs();
					if(rcs.length == 0){
						call(false);
						accept("complete");
					}
				}).catch(error=>{
					reject([client, error]);
				});
			});
		});
	}

	function switcher(err=false, msg){
		if(location.host.indexOf("freebitco.in") != -1){
            if(!err){
                $("#free_play_form_button").click();
                setTimeout(function(){
                    location.reload();
                    console.log("Actualizando pagina en " + RELOAD_TIME + " segundos...");
                }, RELOAD_TIME*10**3);
            }else{
                location.reload();
                console.log("Actualizando pagina en " + RELOAD_TIME + " segundos...");
            }
		}
	}

	var allowed = false;
	for(let domain of ALLOWED_DOMAINS){
		if(location.host.indexOf(domain) != -1){
			allowed = true;
		}
	}
	if(allowed){
		setTimeout(function(){
			if(!proccessing){
				verify_captcha(x=>(proccessing=x)).then(function(result){
					if(result == "complete"){
						switcher();
					}
				}).catch(([client, error])=>{
					client.post_message("Ha ocurrido un error... Revisa la consola para detalles...");
                    switcher(true, error);
					console.log("Ha ocurrido un error:", error);
				});
			}
			setTimeout(arguments.callee, 5e2);
		}, 5e2);
	}else{
		console.log("La pagina no esta admitida para la resolucion de captchas...");
		console.log("Si quieres permitirla agregala en la variable(array) ALLOWED_DOMAINS");
	}
})();
