import { User } from "../../../model/conversation";
import type VKApi from "../api";

export default abstract class VKUser extends User<VKApi>{ }
