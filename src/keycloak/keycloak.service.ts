import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import axios, { AxiosResponse } from 'axios';
import { HttpMethod } from 'src/enums/http-methods.enum';
import { UserRoles } from 'src/users/enums/user-roles.enum';
import { CreateUserDto } from './dtos/create-user.dto';
import { TokenResponseDto } from './dtos/token-response.dto';
import { RequiredActions } from './enums/required-actions.enum';

@Injectable()
export class KeycloakService {
	private token: string;

	constructor(private readonly jwtService: JwtService) {}

	private async generateKeycloakToken(): Promise<string> {
		const tokenResponse: AxiosResponse<TokenResponseDto, unknown> =
			await axios.post(
				`${process.env.KEYCLOAK_URL}/realms/${process.env.KEYCLOAK_REALM}/protocol/openid-connect/token`,
				new URLSearchParams({
					grant_type: 'client_credentials',
					client_id: process.env.KEYCLOAK_CLIENT_ID,
					client_secret: process.env.KEYCLOAK_CLIENT_SECRET,
				}),
				{
					headers: {
						'Content-Type': 'application/x-www-form-urlencoded',
					},
				},
			);

		this.token = tokenResponse.data.access_token;

		return tokenResponse.data.access_token;
	}

	private async requestToKeycloak({
		url,
		method,
		data,
		headers,
	}: {
		url: string;
		method: HttpMethod;
		headers?: object;
		data?: object;
	}) {
		if (
			!this.token ||
			this.jwtService.decode(this.token).exp * 1000 - Date.now() < 60000
		)
			await this.generateKeycloakToken();

		return axios.request({
			method,
			url,
			data,
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${this.token}`,
				...headers,
			},
		});
	}

	private async getRealmRoles() {
		return (
			await this.requestToKeycloak({
				url: `${process.env.KEYCLOAK_URL}/admin/realms/${process.env.KEYCLOAK_REALM}/roles`,
				method: HttpMethod.GET,
			})
		).data;
	}

	public async createUser({ username, email, name, enabled }: CreateUserDto) {
		return await this.requestToKeycloak({
			url: `${process.env.KEYCLOAK_URL}/admin/realms/${process.env.KEYCLOAK_REALM}/users`,
			method: HttpMethod.POST,
			data: {
				attributes: { name },
				username,
				email,
				enabled: enabled ?? true,
				requiredActions: [RequiredActions.UPDATE_PASSWORD],
				emailVerified: true,
			},
		});
	}

	public updateUserName(id: string, name: string) {
		return this.requestToKeycloak({
			url: `${process.env.KEYCLOAK_URL}/admin/realms/${process.env.KEYCLOAK_REALM}/users/${id}`,
			method: HttpMethod.PUT,
			data: { attributes: { name } },
		});
	}

	public async assingUserRole(id: string, role: UserRoles) {
		const roles: { id: string; name: string }[] =
			await this.getRealmRoles();

		return this.requestToKeycloak({
			url: `${process.env.KEYCLOAK_URL}/admin/realms/${process.env.KEYCLOAK_REALM}/users/${id}/role-mappings/realm`,
			method: HttpMethod.POST,
			data: [roles.find((r) => r.name === role)],
		});
	}

	public async removeUserRole(id: string, role: UserRoles) {
		const roles: { id: string; name: string }[] =
			await this.getRealmRoles();

		return this.requestToKeycloak({
			url: `${process.env.KEYCLOAK_URL}/admin/realms/${process.env.KEYCLOAK_REALM}/users/${id}/role-mappings/realm`,
			method: HttpMethod.DELETE,
			data: [roles.find((r) => r.name === role)],
		});
	}

	public deleteUser(id: string) {
		return this.requestToKeycloak({
			url: `${process.env.KEYCLOAK_URL}/admin/realms/${process.env.KEYCLOAK_REALM}/users/${id}`,
			method: HttpMethod.DELETE,
		});
	}
}
